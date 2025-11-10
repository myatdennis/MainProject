import express from 'express';

const app = express();
const router = express.Router();

router.get('/', (_req: express.Request, res: express.Response) => {
  res.send('Test server is working');
});

app.use(router);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});