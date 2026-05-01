import app from './index.js';

const port = Number(process.env.PORT || 3000);

const server = app.listen(port, () => {
   
  console.log(`[bootstrap] Server listening on port ${port} (health: /api/health)`);
});

server.on('error', (err) => {
   
  console.error('[bootstrap] Server error', err);
  process.exit(1);
});

export default server;
