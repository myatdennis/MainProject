// @ts-nocheck
import express from 'express';
import textContentRouter from './routes/textContent';
import aiRouter from './routes/ai';
// ... other imports and setup

const app = express();
app.use(express.json());

// ... other app.use() calls

app.use('/api/text-content', textContentRouter);
app.use('/api/ai', aiRouter);

// Minimal runnable server setup
const port = process.env.PORT || 4000;
app.get('/health', (_req, res) => res.json({ ok: true }));

if (require.main === module) {
	app.listen(port, () => {
		console.log(`Server running on http://localhost:${port}`);
	});
}

export default app;