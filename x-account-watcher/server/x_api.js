const { dbAsync } = require('./db');
const { translateEnToVi, isEnglish } = require('./translator');

/**
 * X API v2 Real Data Client
 * Strictly Read-only: Fetches tweets & replies for specified account handles.
 * Supports both User Timeline endpoint and Recent Search fallback (`from:username`).
 */
async function fetchTweetsForAccount(account, bearerToken, geminiApiKey) {
  if (!bearerToken || bearerToken.trim() === '') {
    console.warn(`[X_API] X_BEARER_TOKEN is missing for @${account.username}. Cannot fetch real data.`);
    return {
      success: false,
      reason: 'missing_x_bearer_token',
      message: '⚠️ Chưa cấu hình X_BEARER_TOKEN trong file .env. Vui lòng điền X API Token để quét bài đăng từ X.',
      items: []
    };
  }

  const usernameClean = account.username.replace(/^@/, '').trim();

  try {
    // Strategy 1: Try Recent Search API (from:username) - Best compatibility across X API v2 tiers
    const searchUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent('from:' + usernameClean)}&tweet.fields=created_at,referenced_tweets,lang,conversation_id&max_results=20`;
    let response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    let rateRemaining = response.headers.get('x-rate-limit-remaining');
    let rateReset = response.headers.get('x-rate-limit-reset');

    await dbAsync.run(`
      INSERT INTO api_logs (endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      `/2/tweets/search/recent?query=from:${usernameClean}`,
      response.status,
      1,
      rateRemaining ? parseInt(rateRemaining) : null,
      rateReset ? new Date(parseInt(rateReset) * 1000).toISOString() : null,
      `Searched tweets from @${usernameClean}`
    ]);

    // Strategy 2: If Search endpoint fails or is unauthorized, try User ID timeline lookup
    if (!response.ok && response.status !== 429) {
      console.log(`[X_API] Search endpoint returned ${response.status}. Trying User ID timeline lookup...`);
      const userUrl = `https://api.twitter.com/2/users/by/username/${usernameClean}`;
      const userRes = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.data && userData.data.id) {
          const xUserId = userData.data.id;
          const tweetsUrl = `https://api.twitter.com/2/users/${xUserId}/tweets?tweet.fields=created_at,referenced_tweets,lang&max_results=20`;
          response = await fetch(tweetsUrl, {
            headers: {
              'Authorization': `Bearer ${bearerToken}`,
              'Content-Type': 'application/json'
            }
          });
          rateRemaining = response.headers.get('x-rate-limit-remaining');
          rateReset = response.headers.get('x-rate-limit-reset');
        }
      }
    }

    if (response.status === 429) {
      return {
        success: false,
        reason: 'rate_limited',
        message: `Bị giới hạn tần suất gọi API (429 Rate Limit) từ X. Vui lòng chờ đến ${new Date(parseInt(rateReset) * 1000).toLocaleTimeString('vi-VN')}.`,
        items: []
      };
    }

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        reason: `api_failed_${response.status}`,
        message: `Không thể tải bài viết của @${usernameClean} từ X (Mã lỗi ${response.status}). Có thể cần kiểm tra gói X API Token.`,
        items: []
      };
    }

    const tweetsData = await response.json();
    const rawTweets = tweetsData.data || [];
    const processedItems = [];

    for (const tweet of rawTweets) {
      let postType = 'tweet';
      if (tweet.referenced_tweets && tweet.referenced_tweets.some(r => r.type === 'replied_to')) {
        postType = 'reply';
      } else if (tweet.referenced_tweets && tweet.referenced_tweets.some(r => r.type === 'retweeted')) {
        postType = 'retweet';
      }

      const originalLang = tweet.lang || (isEnglish(tweet.text) ? 'en' : 'vi');
      let translatedContent = null;

      if (originalLang === 'en' || isEnglish(tweet.text)) {
        translatedContent = await translateEnToVi(tweet.text, geminiApiKey);
      }

      processedItems.push({
        account_username: usernameClean,
        tweet_id: tweet.id,
        post_type: postType,
        original_content: tweet.text,
        translated_content: translatedContent,
        original_lang: originalLang,
        original_url: `https://x.com/${usernameClean}/status/${tweet.id}`,
        post_date: tweet.created_at || new Date().toISOString()
      });
    }

    return {
      success: true,
      rateLimitRemaining: rateRemaining ? parseInt(rateRemaining) : 100,
      items: processedItems
    };

  } catch (err) {
    console.error(`[X_API] Exception fetching @${usernameClean}: ${err.message}`);
    return {
      success: false,
      reason: err.message,
      message: `Lỗi kết nối khi gọi X API: ${err.message}`,
      items: []
    };
  }
}

module.exports = {
  fetchTweetsForAccount
};
