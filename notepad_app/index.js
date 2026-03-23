const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve frontend files

const DB_PATH = path.join(__dirname, 'notes.db');
const db = new sqlite3.Database(DB_PATH);

// Initialize DB schema
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Create note
app.post('/api/notes', (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required.' });
  
  const stmt = db.prepare('INSERT INTO notes (content) VALUES (?)');
  stmt.run(content.trim(), function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, content, created_at: new Date().toISOString() });
  });
  stmt.finalize();
});

// Read notes list (limit to latest 20)
app.get('/api/notes', (req, res) => {
  db.all('SELECT id, content, created_at FROM notes ORDER BY created_at DESC LIMIT 20', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Delete specific note
app.delete('/api/notes/:id', (req, res) => {
  const id = Number(req.params.id);
  db.run('DELETE FROM notes WHERE id = ?', id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Note not found.' });
    res.json({ deletedId: id });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
