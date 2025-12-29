import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHttpError, withHttpError } from '../middleware/apiErrorHandler.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentPath = path.join(__dirname, '../../src/content/textContent.json');

const readContent = async () => {
  const data = await fs.readFile(contentPath, 'utf8');
  return JSON.parse(data);
};

const writeContent = async (items) => {
  await fs.writeFile(contentPath, JSON.stringify(items, null, 2), 'utf8');
};

// GET all text content
router.get('/', async (req, res, next) => {
  try {
    const data = await readContent();
    const items = Object.entries(data).map(([key, value]) => ({ key, value }));
    res.json(items);
  } catch (error) {
    next(withHttpError(error, 500, 'text_content_load_failed'));
  }
});

// PUT to update all text content
router.put('/', async (req, res, next) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return next(createHttpError(400, 'invalid_payload', 'Expected an array of content entries'));
    }

    const contentJson = {};
    items.forEach((item) => {
      if (item && typeof item.key === 'string') {
        contentJson[item.key] = item.value;
      }
    });

    await writeContent(contentJson);
    res.json({ success: true });
  } catch (error) {
    next(withHttpError(error, 500, 'text_content_save_failed'));
  }
});

export default router;
