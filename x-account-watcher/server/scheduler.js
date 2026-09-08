const cron = require('node-cron');
const { dbAsync } = require('./db');
const { fetchTweetsForAccount } = require('./x_api');

let isScanning = false;
let lastScanResult = {
  timestamp: null,
  totalFetched: 0,
  newInserted: 0,
  duplicatesSkipped: 0,
  statusMessage: '',
  details: []
};

async function runScan() {
  if (isScanning) {
    console.log('[Scheduler] Scan already in progress. Skipping...');
    return { status: 'busy', message: 'Quét dữ liệu đang diễn ra...' };
  }

  isScanning = true;
  console.log(`[Scheduler] Starting X Account Watcher scan at ${new Date().toISOString()}...`);

  let totalFetched = 0;
  let newInserted = 0;
  let duplicatesSkipped = 0;
  const details = [];

  const token = process.env.X_BEARER_TOKEN;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!token || token.trim() === '') {
    isScanning = false;
    lastScanResult = {
      timestamp: new Date().toISOString(),
      totalFetched: 0,
      newInserted: 0,
      duplicatesSkipped: 0,
      statusMessage: '⚠️ Chưa cấu hình X_BEARER_TOKEN trong file .env. Vui lòng điền X API Token để bắt đầu quét dữ liệu thật từ X.',
      details: []
    };
    return { status: 'warning', result: lastScanResult };
  }

  try {
    const accounts = await dbAsync.all(`SELECT * FROM accounts WHERE active = 1`);

    for (const acc of accounts) {
      console.log(`[Scheduler] Scanning account: @${acc.username}`);
      const res = await fetchTweetsForAccount(acc, token, geminiKey);

      let accInserted = 0;
      let accSkipped = 0;

      if (res.success && res.items) {
        totalFetched += res.items.length;

        for (const item of res.items) {
          try {
            const insertRes = await dbAsync.run(`
              INSERT OR IGNORE INTO posts 
              (account_username, tweet_id, post_type, original_content, translated_content, original_lang, original_url, post_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              item.account_username,
              item.tweet_id,
              item.post_type,
              item.original_content,
              item.translated_content,
              item.original_lang,
              item.original_url,
              item.post_date
            ]);

            if (insertRes.changes > 0) {
              accInserted++;
            } else {
              accSkipped++;
            }
          } catch (err) {
            console.error(`[Scheduler] Error inserting tweet ${item.tweet_id}:`, err.message);
          }
        }
      }

      newInserted += accInserted;
      duplicatesSkipped += accSkipped;

      details.push({
        account: acc.username,
        success: res.success,
        message: res.message || '',
        fetched: res.items ? res.items.length : 0,
        inserted: accInserted,
        duplicates: accSkipped,
        rateLimitRemaining: res.rateLimitRemaining
      });
    }

    lastScanResult = {
      timestamp: new Date().toISOString(),
      totalFetched,
      newInserted,
      duplicatesSkipped,
      statusMessage: `✅ Hoàn thành quét: ${newInserted} bài mới, ${duplicatesSkipped} bài trùng lặp.`,
      details
    };

    console.log(`[Scheduler] Scan finished. New: ${newInserted}, Duplicates: ${duplicatesSkipped}`);
    return { status: 'success', result: lastScanResult };

  } catch (err) {
    console.error('[Scheduler] Scan failed:', err);
    return { status: 'error', error: err.message };
  } finally {
    isScanning = false;
  }
}

function startCronScheduler() {
  const scheduleStr = process.env.CRON_SCHEDULE || '0 */6 * * *';
  console.log(`[Scheduler] Cron scheduled with pattern: "${scheduleStr}"`);
  
  cron.schedule(scheduleStr, async () => {
    console.log('[Cron] Triggering automatic account scan job...');
    await runScan();
  });
}

function getLastScanResult() {
  return lastScanResult;
}

module.exports = {
  runScan,
  startCronScheduler,
  getLastScanResult
};
