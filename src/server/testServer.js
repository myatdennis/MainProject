import express from 'express';
const app = express();
const router = express.Router();
router.get('/', (_req, res) => {
    res.send('Test server is working');
});
app.use(router);
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Test server running on http://localhost:${PORT}`);
});
