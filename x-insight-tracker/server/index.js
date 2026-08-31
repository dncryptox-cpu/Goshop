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

// 1. GET /api/insights - Fetch filtered insights
app.get('/api/insights', async (req, res) => {
  try {
    const { project, sourceType, notableOnly, search, startDate, endDate } = req.query;
    let sql = `SELECT * FROM insights WHERE is_deleted = 0`;
    const params = [];

    if (project && project !== 'All') {
      sql += ` AND project_name = ?`;
      params.push(project);
    }

    if (sourceType && sourceType !== 'all') {
      sql += ` AND source_type = ?`;
      params.push(sourceType);
    }

    if (notableOnly === 'true') {
      sql += ` AND is_notable = 1`;
    }

    if (search && search.trim() !== '') {
      sql += ` AND (summary LIKE ? OR author_handle LIKE ? OR author_name LIKE ?)`;
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

// 2. POST /api/insights/:id/notable - Toggle notable bookmark
app.post('/api/insights/:id/notable', async (req, res) => {
  try {
    const { id } = req.params;
    const current = await dbAsync.get(`SELECT is_notable FROM insights WHERE id = ?`, [id]);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Insight not found' });
    }
    const newStatus = current.is_notable ? 0 : 1;
    await dbAsync.run(`UPDATE insights SET is_notable = ? WHERE id = ?`, [newStatus, id]);
    res.json({ success: true, is_notable: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. DELETE /api/insights/:id - Soft delete item (if falsely filtered)
app.delete('/api/insights/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`UPDATE insights SET is_deleted = 1 WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST /api/scan - Manual trigger scan
app.post('/api/scan', async (req, res) => {
  try {
    const scanRes = await runScan();
    res.json(scanRes);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. GET /api/scan/status - Last scan status
app.get('/api/scan/status', (req, res) => {
  res.json({ success: true, lastScan: getLastScanResult() });
});

// 6. GET /api/projects - List tracked projects
app.get('/api/projects', async (req, res) => {
  try {
    const rows = await dbAsync.all(`SELECT * FROM projects WHERE active = 1 ORDER BY id ASC`);
    const parsed = rows.map(r => ({
      ...r,
      keywords: JSON.parse(r.keywords),
      official_handles: JSON.parse(r.official_handles)
    }));
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. POST /api/projects - Add new project
app.post('/api/projects', async (req, res) => {
  try {
    const { name, keywords, official_handles } = req.body;
    if (!name || !keywords) {
      return res.status(400).json({ success: false, message: 'Name and keywords required' });
    }
    const kwArr = Array.isArray(keywords) ? keywords : keywords.split(',').map(s => s.trim());
    const handleArr = Array.isArray(official_handles) ? official_handles : (official_handles || '').split(',').map(s => s.trim());

    await dbAsync.run(`
      INSERT INTO projects (name, keywords, official_handles)
      VALUES (?, ?, ?)
    `, [name, JSON.stringify(kwArr), JSON.stringify(handleArr)]);

    res.json({ success: true, message: 'Project added' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. DELETE /api/projects/:id - Deactivate project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run(`UPDATE projects SET active = 0 WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Project deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. GET /api/rate-limit - Usage logs
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
    console.log(`  X Insight Tracker is running on http://localhost:${PORT}`);
    console.log(`====================================================`);
    startCronScheduler();
  });
}).catch(err => {
  console.error('Failed to initialize Database:', err);
});
