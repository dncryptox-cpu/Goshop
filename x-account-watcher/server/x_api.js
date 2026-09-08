const { dbAsync } = require('./db');
const { translateEnToVi, isEnglish } = require('./translator');

/**
 * X API v2 Real Data Client
 * Strictly Read-only: Fetches tweets & replies for specified account handles.
 * NO FAKE/MOCK DATA IS GENERATED. If token is missing or API fails, explicit error is returned.
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
    // Step 1: Get User ID from username
    const userUrl = `https://api.twitter.com/2/users/by/username/${usernameClean}`;
    const userRes = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    const rateRemaining = userRes.headers.get('x-rate-limit-remaining');
    const rateReset = userRes.headers.get('x-rate-limit-reset');

    // Log API Usage
    await dbAsync.run(`
      INSERT INTO api_logs (endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      `/2/users/by/username/${usernameClean}`,
      userRes.status,
      1,
      rateRemaining ? parseInt(rateRemaining) : null,
      rateReset ? new Date(parseInt(rateReset) * 1000).toISOString() : null,
      `Fetched user ID for @${usernameClean}`
    ]);

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error(`[X_API] User lookup failed (${userRes.status}): ${errText}`);
      return {
        success: false,
        reason: `user_lookup_failed_${userRes.status}`,
        message: `Không thể tìm thấy tài khoản @${usernameClean} trên X (Mã lỗi ${userRes.status}).`,
        items: []
      };
    }

    const userData = await userRes.json();
    if (!userData.data || !userData.data.id) {
      return {
        success: false,
        reason: 'user_not_found',
        message: `Tài khoản @${usernameClean} không tồn tại hoặc đã bị khoá trên X.`,
        items: []
      };
    }

    const xUserId = userData.data.id;
    const xDisplayName = userData.data.name || usernameClean;

    // Update x_user_id and display_name in database
    await dbAsync.run(`
      UPDATE accounts SET x_user_id = ?, display_name = ? WHERE username = ?
    `, [xUserId, xDisplayName, usernameClean]);

    // Step 2: Fetch recent tweets & replies for this user ID
    const tweetsUrl = `https://api.twitter.com/2/users/${xUserId}/tweets?tweet.fields=created_at,referenced_tweets,lang,conversation_id&max_results=20`;
    const tweetsRes = await fetch(tweetsUrl, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    const tweetRateRemaining = tweetsRes.headers.get('x-rate-limit-remaining');
    const tweetRateReset = tweetsRes.headers.get('x-rate-limit-reset');

    await dbAsync.run(`
      INSERT INTO api_logs (endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      `/2/users/${xUserId}/tweets`,
      tweetsRes.status,
      1,
      tweetRateRemaining ? parseInt(tweetRateRemaining) : null,
      tweetRateReset ? new Date(parseInt(tweetRateReset) * 1000).toISOString() : null,
      `Fetched timeline for @${usernameClean}`
    ]);

    if (tweetsRes.status === 429) {
      return {
        success: false,
        reason: 'rate_limited',
        message: `Bị giới hạn tần suất gọi API (429 Rate Limit) từ X. Vui lòng chờ đến ${new Date(parseInt(tweetRateReset) * 1000).toLocaleTimeString('vi-VN')}.`,
        items: []
      };
    }

    if (!tweetsRes.ok) {
      const errText = await tweetsRes.text();
      return {
        success: false,
        reason: `timeline_failed_${tweetsRes.status}`,
        message: `Không thể tải timeline bài viết của @${usernameClean} (Mã lỗi ${tweetsRes.status}).`,
        items: []
      };
    }

    const tweetsData = await tweetsRes.json();
    const rawTweets = tweetsData.data || [];
    const processedItems = [];

    for (const tweet of rawTweets) {
      // Determine post type: 'reply' if referenced_tweets has 'replied_to', else 'tweet'
      let postType = 'tweet';
      if (tweet.referenced_tweets && tweet.referenced_tweets.some(r => r.type === 'replied_to')) {
        postType = 'reply';
      } else if (tweet.referenced_tweets && tweet.referenced_tweets.some(r => r.type === 'retweeted')) {
        postType = 'retweet';
      }

      // Check language & perform Gemini translation if English
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
      rateLimitRemaining: tweetRateRemaining ? parseInt(tweetRateRemaining) : 100,
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
