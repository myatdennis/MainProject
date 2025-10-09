import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5173;

const distPath = path.resolve(__dirname, '../dist');

// Serve static files from the dist directory
app.use(express.static(distPath));

// For SPA client-side routing — serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Serving production build from ${distPath} at http://localhost:${port}`);
});
