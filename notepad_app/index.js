const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (Temporary fix for Vercel/Serverless)
let notes = [];
let nextId = 1;

// Create note
app.post('/api/notes', (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required.' });
  
  const newNote = {
    id: nextId++,
    content: content.trim(),
    created_at: new Date().toISOString()
  };
  notes.unshift(newNote); // Add to beginning
  res.json(newNote);
});

// Read notes list (limit to latest 20)
app.get('/api/notes', (req, res) => {
  res.json(notes.slice(0, 20));
});

// Delete specific note
app.delete('/api/notes/:id', (req, res) => {
  const id = Number(req.params.id);
  const initialLength = notes.length;
  notes = notes.filter(n => n.id !== id);
  
  if (notes.length === initialLength) return res.status(404).json({ error: 'Note not found.' });
  res.json({ deletedId: id });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
