const { dbAsync } = require('./db');
const { isOfficialContent, summarizeTweet, classifySourceType } = require('./filter_summarizer');

/**
 * X API v2 Connector with Rate Limit logging & Fallback Mock Mode
 */
async function fetchTweetsForProject(project, bearerToken) {
  const keywords = typeof project.keywords === 'string' ? JSON.parse(project.keywords) : project.keywords;
  const officialHandles = typeof project.official_handles === 'string' ? JSON.parse(project.official_handles) : project.official_handles;

  if (!bearerToken || bearerToken.trim() === '') {
    console.log(`[X_API] No X_BEARER_TOKEN configured. Using Mock Data Mode for project: ${project.name}`);
    return fetchMockTweets(project, officialHandles);
  }

  // Construct search query (exclude retweets)
  const queryStr = `${keywords.join(' OR ')} -is:retweet`;
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(queryStr)}&tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=username,name,verified&max_results=20`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    const rateLimitLimit = response.headers.get('x-rate-limit-limit');
    const rateLimitRemaining = response.headers.get('x-rate-limit-remaining');
    const rateLimitReset = response.headers.get('x-rate-limit-reset');

    // Log API usage to database
    await dbAsync.run(`
      INSERT INTO api_logs (endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      '/2/tweets/search/recent',
      response.status,
      1,
      rateLimitRemaining ? parseInt(rateLimitRemaining) : null,
      rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toISOString() : null,
      `Searched project: ${project.name}`
    ]);

    if (response.status === 429) {
      console.warn(`[X_API] Rate limit reached (429) for project ${project.name}. Backing off...`);
      return { success: false, reason: 'rate_limited', rateLimitRemaining: 0, items: [] };
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[X_API] API Error (${response.status}): ${errText}`);
      return { success: false, reason: `http_${response.status}`, items: [] };
    }

    const data = await response.json();
    const usersMap = {};
    if (data.includes && data.includes.users) {
      data.includes.users.forEach(u => {
        usersMap[u.id] = u;
      });
    }

    const rawTweets = data.data || [];
    const processedItems = [];

    for (const tweet of rawTweets) {
      const author = usersMap[tweet.author_id] || { username: 'unknown', name: 'Unknown User' };
      
      // 1. Filter out official content
      if (isOfficialContent(author.username, tweet.text, officialHandles)) {
        console.log(`[X_API] Filtered out official tweet from @${author.username}`);
        continue;
      }

      // 2. Paraphrase summary (max 2-3 sentences)
      const summary = summarizeTweet(tweet.text, author.name);
      
      // 3. Classify source type
      const sourceType = classifySourceType(tweet.text, author.username);

      processedItems.push({
        project_name: project.name,
        original_url: `https://x.com/${author.username}/status/${tweet.id}`,
        tweet_id: tweet.id,
        author_handle: author.username,
        author_name: author.name,
        summary: summary,
        source_type: sourceType,
        post_date: tweet.created_at || new Date().toISOString()
      });
    }

    return {
      success: true,
      rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : 100,
      items: processedItems
    };

  } catch (err) {
    console.error(`[X_API] Exception during API call: ${err.message}`);
    return { success: false, reason: err.message, items: [] };
  }
}

/**
 * Mock Data Generator for testing & demonstration without consuming API credits
 */
async function fetchMockTweets(project, officialHandles) {
  // Log mock API call to database
  await dbAsync.run(`
    INSERT INTO api_logs (endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    '/2/tweets/search/recent (mock)',
    200,
    1,
    98,
    new Date(Date.now() + 900000).toISOString(),
    `Mock search for ${project.name}`
  ]);

  const now = new Date();
  let candidateMockTweets = [];

  if (project.name === 'Tread.fi') {
    candidateMockTweets = [
      {
        id: '18291001001',
        author_handle: 'tread_fi', // OFFICIAL - MUST BE FILTERED OUT
        author_name: 'Tread.fi Official',
        text: 'We are thrilled to announce Tread.fi V2 mainnet release! Join our upcoming AMA with the core team.',
        created_at: new Date(now - 3600000 * 2).toISOString()
      },
      {
        id: '18291001002',
        author_handle: 'degen_trader_x',
        author_name: 'Degen Trader',
        text: 'Vừa dùng thử Tread.fi để rebalance kho Vault tự động trên Hyperliquid. Phí gas khá rẻ nhưng thi thoảng bị delay 10s khi khớp lệnh lúc thị trường biến động mạnh.',
        created_at: new Date(now - 3600000 * 4).toISOString()
      },
      {
        id: '18291001003',
        author_handle: 'quant_alpha',
        author_name: 'Alpha Quant Lab',
        text: 'Phân tích nhanh cấu trúc phí của Tread.fi vs các Bot Grid truyền thống. Yield cải thiện nhờ cơ chế tự điều chỉnh kho đệm spread, đáng để thử nghiệm.',
        created_at: new Date(now - 3600000 * 8).toISOString()
      },
      {
        id: '18291001004',
        author_handle: 'crypto_warning_bot',
        author_name: 'Crypto Safety Sentinel',
        text: 'Cảnh báo: Có website phishing giả mạo Tread.fi chạy quảng cáo trên Google Ads. Mọi người chú ý chỉ truy cập đúng link gốc tread.fi.',
        created_at: new Date(now - 3600000 * 12).toISOString()
      },
      {
        id: '18291001005',
        author_handle: 'user_viet_crypto',
        author_name: 'Minh Tuấn (DeFi User)',
        text: 'Anh em có ai bị lỗi không bấm rút tiền được trên Tread.fi chiều nay không? Mình bấm withdraw thì app cứ quay tròn, đổi mạng RPC thì mới được.',
        created_at: new Date(now - 3600000 * 16).toISOString()
      }
    ];
  } else if (project.name.startsWith('HIP-3')) {
    candidateMockTweets = [
      {
        id: '18292002001',
        author_handle: 'HyperliquidX', // OFFICIAL - MUST BE FILTERED OUT
        author_name: 'Hyperliquid',
        text: 'Official release of HIP-3 specification. Read our blog for full technical documentation.',
        created_at: new Date(now - 3600000 * 3).toISOString()
      },
      {
        id: '18292002002',
        author_handle: 'hl_builder_dev',
        author_name: 'Hyperliquid Builder',
        text: 'Đang test đề xuất HIP-3 trên testnet. Cơ chế thanh khoản mới giúp giảm slippage khi giao dịch token vốn hoá vừa, trải nghiệm mượt hơn hẳn HIP-2.',
        created_at: new Date(now - 3600000 * 5).toISOString()
      },
      {
        id: '18292002003',
        author_handle: 'defi_researcher',
        author_name: 'Research Crypto',
        text: 'So sánh tác động của HIP-3 lên các Builder Vaults: Tỷ lệ phân bổ rewards cho vault maker tăng 15%, thu hút thêm các market maker nhỏ.',
        created_at: new Date(now - 3600000 * 9).toISOString()
      },
      {
        id: '18292002004',
        author_handle: 'trading_noob99',
        author_name: 'Trader Gà',
        text: 'HIP-3 áp dụng xong thì phí maker có được giảm thêm không mọi người? Mình trade volume cỡ 50k$/tháng liệu có ảnh hưởng nhiều không?',
        created_at: new Date(now - 3600000 * 14).toISOString()
      }
    ];
  } else {
    candidateMockTweets = [
      {
        id: '18293003001',
        author_handle: 'hl_dev_community',
        author_name: 'Hyperliquid Devs',
        text: 'Thảo luận về HIP-4: Đề xuất tích hợp cơ chế oracle backup mới để tránh lỗi flash crash khi feed giá sàn CEX bị nghẽn.',
        created_at: new Date(now - 3600000 * 6).toISOString()
      },
      {
        id: '18293003002',
        author_handle: 'oracle_checker',
        author_name: 'Oracle Auditor',
        text: 'Đánh giá HIP-4: Cơ chế tính trung bình giá (TWAP) cải tiến chống manipulation tốt hơn, an toàn cho các lệnh perp đòn bẩy cao.',
        created_at: new Date(now - 3600000 * 10).toISOString()
      }
    ];
  }

  const processedItems = [];

  for (const tweet of candidateMockTweets) {
    // 1. Filter out official content
    if (isOfficialContent(tweet.author_handle, tweet.text, officialHandles)) {
      console.log(`[X_API Mock] Filtered out official tweet from @${tweet.author_handle}`);
      continue;
    }

    // 2. Paraphrase summary
    const summary = summarizeTweet(tweet.text, tweet.author_name);

    // 3. Classify source type
    const sourceType = classifySourceType(tweet.text, tweet.author_handle);

    processedItems.push({
      project_name: project.name,
      original_url: `https://x.com/${tweet.author_handle}/status/${tweet.id}`,
      tweet_id: tweet.id,
      author_handle: tweet.author_handle,
      author_name: tweet.author_name,
      summary: summary,
      source_type: sourceType,
      post_date: tweet.created_at
    });
  }

  return {
    success: true,
    rateLimitRemaining: 98,
    items: processedItems
  };
}

module.exports = {
  fetchTweetsForProject
};
