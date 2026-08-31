const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'tracker.db');
const db = new sqlite3.Database(dbPath);

function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Projects table
      db.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          keywords TEXT NOT NULL,
          official_handles TEXT NOT NULL,
          active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 2. Insights table with unique constraint on original_url for deduplication
      db.run(`
        CREATE TABLE IF NOT EXISTS insights (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          original_url TEXT UNIQUE NOT NULL,
          tweet_id TEXT UNIQUE NOT NULL,
          author_handle TEXT NOT NULL,
          author_name TEXT NOT NULL,
          summary TEXT NOT NULL,
          source_type TEXT NOT NULL,
          post_date TEXT NOT NULL,
          fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
          is_notable INTEGER DEFAULT 0,
          is_deleted INTEGER DEFAULT 0
        )
      `);

      // 3. API Logs table for rate-limit tracking
      db.run(`
        CREATE TABLE IF NOT EXISTS api_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          endpoint TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          requests_count INTEGER DEFAULT 1,
          rate_limit_remaining INTEGER,
          rate_limit_reset TEXT,
          note TEXT
        )
      `, (err) => {
        if (err) return reject(err);
        seedDefaultProjects().then(resolve).catch(reject);
      });
    });
  });
}

function seedDefaultProjects() {
  return new Promise((resolve, reject) => {
    const defaults = [
      {
        name: 'Tread.fi',
        keywords: JSON.stringify(['Tread.fi', 'TreadFi', '@tread_fi', 'tread fi']),
        official_handles: JSON.stringify(['tread_fi', 'treadfi', 'tread_fi_official'])
      },
      {
        name: 'HIP-3',
        keywords: JSON.stringify(['HIP-3', 'HIP3', 'HIP 3', 'Hyperliquid HIP-3']),
        official_handles: JSON.stringify(['HyperliquidX', 'Hyperliquid_App', 'Hyperliquid_HQ'])
      },
      {
        name: 'HIP-4',
        keywords: JSON.stringify(['HIP-4', 'HIP4', 'HIP 4', 'Hyperliquid HIP-4']),
        official_handles: JSON.stringify(['HyperliquidX', 'Hyperliquid_App', 'Hyperliquid_HQ'])
      }
    ];

    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO projects (name, keywords, official_handles)
        VALUES (?, ?, ?)
      `);
      for (const p of defaults) {
        stmt.run(p.name, p.keywords, p.official_handles);
      }
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// Helper methods wrapped in Promises
const dbAsync = {
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

module.exports = {
  db,
  initDb,
  dbAsync
};
