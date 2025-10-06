import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const contentPath = path.join(__dirname, '../../src/content/textContent.json');

// GET all text content
router.get('/', (req, res) => {
  fs.readFile(contentPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Failed to load content');
    const items = Object.entries(JSON.parse(data)).map(([key, value]) => ({ key, value }));
    res.json(items);
  });
});

// PUT to update all text content
router.put('/', (req, res) => {
  const items = req.body; // [{ key, value }]
  const contentJson = {};
  items.forEach(item => { contentJson[item.key] = item.value; });
  fs.writeFile(contentPath, JSON.stringify(contentJson, null, 2), err => {
    if (err) return res.status(500).send('Failed to save content');
    res.send('ok');
  });
});

export default router;
