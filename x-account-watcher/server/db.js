const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'watcher.db');
const db = new sqlite3.Database(dbPath);

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  console.log('[DB] Connected to Supabase Cloud Instance.');
}

function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Accounts Table
      db.run(`
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          display_name TEXT,
          x_user_id TEXT,
          active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 2. Posts Table (deduplicated by tweet_id and original_url)
      db.run(`
        CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_username TEXT NOT NULL,
          tweet_id TEXT UNIQUE NOT NULL,
          post_type TEXT DEFAULT 'tweet',
          original_content TEXT NOT NULL,
          translated_content TEXT,
          original_lang TEXT DEFAULT 'en',
          original_url TEXT UNIQUE NOT NULL,
          post_date TEXT NOT NULL,
          fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
          is_bookmarked INTEGER DEFAULT 0,
          is_deleted INTEGER DEFAULT 0
        )
      `);

      // 3. API Usage Logs Table
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
        seedDefaultAccounts().then(resolve).catch(reject);
      });
    });
  });
}

function seedDefaultAccounts() {
  return new Promise((resolve, reject) => {
    const defaults = [
      { username: 'NMTD8', display_name: 'NMTD8' },
      { username: 'laivietnam91', display_name: 'Lai Vietnam' }
    ];

    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO accounts (username, display_name)
        VALUES (?, ?)
      `);
      for (const a of defaults) {
        stmt.run(a.username, a.display_name);
      }
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// Database Helper Methods wrapped in Promises
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
  dbAsync,
  supabase
};
