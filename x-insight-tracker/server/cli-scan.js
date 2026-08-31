require('dotenv').config();
const { initDb } = require('./db');
const { runScan } = require('./scheduler');

async function main() {
  console.log('[CLI-SCAN] Initializing DB & Running Test Scan...');
  await initDb();
  const res = await runScan();
  console.log('[CLI-SCAN] Scan Result:\n', JSON.stringify(res, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('[CLI-SCAN] Error:', err);
  process.exit(1);
});
