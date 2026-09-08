const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'watcher.db');
const db = new sqlite3.Database(dbPath);

let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL || 'https://ohlrsnxhrbosdebkglqd.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log(`[DB] Connected to Supabase Instance: ${supabaseUrl}`);
}

async function initDb() {
  if (supabase) {
    console.log('[DB] Checking Supabase cloud tables status...');
    try {
      const { error } = await supabase.from('accounts').select('id').limit(1);
      if (error) {
        console.warn('[DB] Supabase tables not ready yet. Run supabase_schema.sql in Supabase SQL Editor:', error.message);
      } else {
        console.log('[DB] Supabase tables verified active.');
      }
    } catch (err) {
      console.warn('[DB] Supabase check:', err.message);
    }
  }

  return new Promise((resolve, reject) => {
    db.serialize(() => {
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

// Database Helper Methods with Supabase Sync
const dbAsync = {
  async all(sql, params = []) {
    if (supabase) {
      try {
        if (sql.includes('FROM accounts')) {
          const { data, error } = await supabase.from('accounts').select('*').eq('active', 1).order('id', { ascending: true });
          if (!error && data && data.length > 0) return data;
        } else if (sql.includes('FROM posts')) {
          const { data, error } = await supabase.from('posts').select('*').eq('is_deleted', 0).order('post_date', { ascending: false });
          if (!error && data) return data;
        } else if (sql.includes('FROM api_logs')) {
          const { data, error } = await supabase.from('api_logs').select('*').order('id', { ascending: false }).limit(20);
          if (!error && data) return data;
        }
      } catch (err) {
        console.warn('[Supabase Sync Error]:', err.message);
      }
    }

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  async get(sql, params = []) {
    if (supabase) {
      try {
        if (sql.includes('COUNT(*) as count FROM api_logs')) {
          const { count, error } = await supabase.from('api_logs').select('*', { count: 'exact', head: true });
          if (!error) return { count: count || 0 };
        }
      } catch (err) {
        // Fallback
      }
    }

    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  async run(sql, params = []) {
    if (supabase) {
      try {
        if (sql.includes('INSERT INTO accounts')) {
          const [username, display_name] = params;
          await supabase.from('accounts').upsert({ username, display_name }, { onConflict: 'username' });
        } else if (sql.includes('INSERT OR IGNORE INTO posts')) {
          const [account_username, tweet_id, post_type, original_content, translated_content, original_lang, original_url, post_date] = params;
          await supabase.from('posts').upsert({
            account_username, tweet_id, post_type, original_content, translated_content, original_lang, original_url, post_date
          }, { onConflict: 'tweet_id' });
        } else if (sql.includes('INSERT INTO api_logs')) {
          const [endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note] = params;
          await supabase.from('api_logs').insert([{ endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note }]);
        }
      } catch (err) {
        console.warn('[Supabase Run Error]:', err.message);
      }
    }

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
