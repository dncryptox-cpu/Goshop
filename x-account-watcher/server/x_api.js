const { dbAsync } = require('./db');
const { translateEnToVi, isEnglish } = require('./translator');

/**
 * Free X Reader Gateway (100% Free - $0 Cost)
 * Fetches real tweets & replies from public RSS mirrors without requiring paid X API subscriptions.
 * Auto-detects English posts and translates them to Vietnamese via Gemini AI.
 */
async function fetchTweetsForAccount(account, bearerToken, geminiApiKey) {
  const usernameClean = account.username.replace(/^@/, '').trim();
  console.log(`[Free_X_Gateway] Fetching real posts for @${usernameClean}...`);

  // List of public RSS mirrors for high reliability
  const rssMirrors = [
    `http://nitter.jaydenha.uk/${usernameClean}/rss`,
    `https://nitter.privacydev.net/${usernameClean}/rss`,
    `https://nitter.poast.org/${usernameClean}/rss`
  ];

  let rawXml = null;
  let usedMirror = '';

  for (const mirrorUrl of rssMirrors) {
    try {
      const response = await fetch(mirrorUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        }
      });

      if (response.ok) {
        rawXml = await response.text();
        usedMirror = mirrorUrl;
        console.log(`[Free_X_Gateway] Successfully fetched XML from mirror: ${mirrorUrl}`);
        break;
      }
    } catch (err) {
      console.warn(`[Free_X_Gateway] Mirror ${mirrorUrl} unavailable:`, err.message);
    }
  }

  // Log API usage to database
  await dbAsync.run(`
    INSERT INTO api_logs (endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    `Free_X_Gateway (RSS: @${usernameClean})`,
    rawXml ? 200 : 500,
    1,
    100,
    new Date(Date.now() + 3600000).toISOString(),
    `Fetched RSS for @${usernameClean} via ${usedMirror || 'none'}`
  ]);

  if (!rawXml) {
    return {
      success: false,
      reason: 'rss_fetch_failed',
      message: `Không thể kết nối cổng đọc bài miễn phí cho @${usernameClean}. Vui lòng thử lại sau ít phút.`,
      items: []
    };
  }

  // Parse RSS XML Items
  const items = parseRssXml(rawXml, usernameClean);
  console.log(`[Free_X_Gateway] Parsed ${items.length} real posts for @${usernameClean}`);

  const processedItems = [];

  for (const item of items) {
    // Detect language & translate English posts via Gemini AI
    const originalLang = isEnglish(item.text) ? 'en' : 'vi';
    let translatedContent = null;

    if (originalLang === 'en') {
      translatedContent = await translateEnToVi(item.text, geminiApiKey);
    }

    processedItems.push({
      account_username: usernameClean,
      tweet_id: item.tweet_id,
      post_type: item.post_type,
      original_content: item.text,
      translated_content: translatedContent,
      original_lang: originalLang,
      original_url: item.original_url,
      post_date: item.post_date
    });
  }

  return {
    success: true,
    rateLimitRemaining: 100,
    items: processedItems
  };
}

/**
 * Parse Nitter RSS XML string into tweet objects
 */
function parseRssXml(xmlString, usernameClean) {
  const items = [];
  const itemMatches = xmlString.match(/<item>[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    // Extract GUID / Tweet ID
    const guidMatch = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    let tweetId = guidMatch ? guidMatch[1].trim() : null;

    // Extract Description / Content
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) || itemXml.match(/<description>([\s\S]*?)<\/description>/i);
    let rawContent = descMatch ? descMatch[1] : '';

    // Extract PubDate
    const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    let postDate = dateMatch ? new Date(dateMatch[1].trim()).toISOString() : new Date().toISOString();

    // Clean HTML tags from content
    let text = rawContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n')
      .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .trim();

    if (!text || text.length === 0) continue;

    // Fallback tweet_id from link if guid is missing
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    let linkUrl = linkMatch ? linkMatch[1].trim() : '';
    if (!tweetId && linkUrl) {
      const idFromLink = linkUrl.match(/\/status\/(\d+)/);
      if (idFromLink) tweetId = idFromLink[1];
    }

    if (!tweetId) {
      tweetId = String(Date.now() + Math.floor(Math.random() * 1000));
    }

    // Determine post type: 'reply' if starts with 'R to @' or contains 'R to', else 'tweet'
    let postType = 'tweet';
    if (text.startsWith('R to @') || text.startsWith('R to ')) {
      postType = 'reply';
      text = text.replace(/^R to @\w+:\s*/, '');
    }

    const originalUrl = `https://x.com/${usernameClean}/status/${tweetId}`;

    items.push({
      tweet_id: tweetId,
      text: text,
      post_type: postType,
      original_url: originalUrl,
      post_date: postDate
    });
  }

  return items;
}

module.exports = {
  fetchTweetsForAccount
};
