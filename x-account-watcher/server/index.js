const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDb, dbAsync } = require('./db');
const { runScan, startCronScheduler, getLastScanResult } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// 1. GET /api/config-status - Returns status of environment API keys
app.get('/api/config-status', (req, res) => {
  const hasXToken = Boolean(process.env.X_BEARER_TOKEN && process.env.X_BEARER_TOKEN.trim() !== '');
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  res.json({
    success: true,
    has_x_token: hasXToken,
    has_gemini_key: hasGeminiKey
  });
});

// 2. GET /api/posts - Query collected posts with filters
app.get('/api/posts', async (req, res) => {
  try {
    const { account, postType, search, startDate, endDate, bookmarkedOnly } = req.query;
    let sql = `SELECT * FROM posts WHERE is_deleted = 0`;
    const params = [];

    if (account && account !== 'All') {
      sql += ` AND account_username = ?`;
      params.push(account.replace(/^@/, ''));
    }

    if (postType && postType !== 'all') {
      sql += ` AND post_type = ?`;
      params.push(postType);
    }

    if (bookmarkedOnly === 'true') {
      sql += ` AND is_bookmarked = 1`;
    }

    if (search && search.trim() !== '') {
      sql += ` AND (original_content LIKE ? OR translated_content LIKE ? OR account_username LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (startDate) {
      sql += ` AND post_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND post_date <= ?`;
      params.push(endDate + 'T23:59:59Z');
    }

    sql += ` ORDER BY post_date DESC`;

    const rows = await dbAsync.all(sql, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/posts/:id/bookmark - Toggle bookmark
app.post('/api/posts/:id/bookmark', async (req, res) => {
  try {
    const { id } = req.params;
    const current = await dbAsync.get(`SELECT is_bookmarked FROM posts WHERE id = ?`, [id]);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    const newStatus = current.is_bookmarked ? 0 : 1;
    await dbAsync.run(`UPDATE posts SET is_bookmarked = ? WHERE id = ?`, [newStatus, id]);
    res.json({ success: true, is_bookmarked: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. DELETE /api/posts/:id - Soft delete post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`UPDATE posts SET is_deleted = 1 WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST /api/scan - Trigger manual scan
app.post('/api/scan', async (req, res) => {
  try {
    const scanRes = await runScan();
    res.json(scanRes);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. GET /api/scan/status - Last scan status
app.get('/api/scan/status', (req, res) => {
  res.json({ success: true, lastScan: getLastScanResult() });
});

// 7. GET /api/accounts - List watched accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const rows = await dbAsync.all(`SELECT * FROM accounts WHERE active = 1 ORDER BY id ASC`);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. POST /api/accounts - Add account
app.post('/api/accounts', async (req, res) => {
  try {
    let { username, display_name } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }
    username = username.replace(/^https?:\/\/(x|twitter)\.com\//, '').replace(/^@/, '').split('/')[0].trim();
    display_name = display_name || username;

    await dbAsync.run(`
      INSERT INTO accounts (username, display_name)
      VALUES (?, ?)
    `, [username, display_name]);

    res.json({ success: true, message: 'Account added', username });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. DELETE /api/accounts/:id - Deactivate account
app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`UPDATE accounts SET active = 0 WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Account deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. GET /api/rate-limit - Usage logs
app.get('/api/rate-limit', async (req, res) => {
  try {
    const logs = await dbAsync.all(`SELECT * FROM api_logs ORDER BY id DESC LIMIT 20`);
    const totalCalls = await dbAsync.get(`SELECT COUNT(*) as count FROM api_logs`);
    res.json({
      success: true,
      total_calls: totalCalls ? totalCalls.count : 0,
      recent_logs: logs
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Express server after DB init
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  X Account Watcher is running on http://localhost:${PORT}`);
    console.log(`====================================================`);
    startCronScheduler();
  });
}).catch(err => {
  console.error('Failed to initialize Database:', err);
});
