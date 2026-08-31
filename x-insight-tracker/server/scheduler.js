const cron = require('node-cron');
const { dbAsync } = require('./db');
const { fetchTweetsForProject } = require('./x_api');

let isScanning = false;
let lastScanResult = {
  timestamp: null,
  totalFetched: 0,
  newInserted: 0,
  duplicatesSkipped: 0,
  details: []
};

async function runScan() {
  if (isScanning) {
    console.log('[Scheduler] Scan already in progress. Skipping...');
    return { status: 'busy', message: 'Scan already in progress' };
  }

  isScanning = true;
  console.log(`[Scheduler] Starting X Insight Scan at ${new Date().toISOString()}...`);

  let totalFetched = 0;
  let newInserted = 0;
  let duplicatesSkipped = 0;
  const details = [];

  try {
    const projects = await dbAsync.all(`SELECT * FROM projects WHERE active = 1`);
    const token = process.env.X_BEARER_TOKEN;

    for (const proj of projects) {
      console.log(`[Scheduler] Scanning project: ${proj.name}`);
      const res = await fetchTweetsForProject(proj, token);

      let projInserted = 0;
      let projSkipped = 0;

      if (res.success && res.items) {
        totalFetched += res.items.length;

        for (const item of res.items) {
          try {
            const insertRes = await dbAsync.run(`
              INSERT OR IGNORE INTO insights 
              (project_name, original_url, tweet_id, author_handle, author_name, summary, source_type, post_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              item.project_name,
              item.original_url,
              item.tweet_id,
              item.author_handle,
              item.author_name,
              item.summary,
              item.source_type,
              item.post_date
            ]);

            if (insertRes.changes > 0) {
              projInserted++;
            } else {
              projSkipped++;
            }
          } catch (err) {
            console.error(`[Scheduler] Error inserting item ${item.original_url}:`, err.message);
          }
        }
      }

      newInserted += projInserted;
      duplicatesSkipped += projSkipped;

      details.push({
        project: proj.name,
        fetched: res.items ? res.items.length : 0,
        inserted: projInserted,
        duplicates: projSkipped,
        rateLimitRemaining: res.rateLimitRemaining
      });
    }

    lastScanResult = {
      timestamp: new Date().toISOString(),
      totalFetched,
      newInserted,
      duplicatesSkipped,
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
    console.log('[Cron] Triggering automatic scan job...');
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
