import express from 'express';
import cors from 'cors';
import textContentRouter from './routes/textContent.js';
import adminUsersRouter from './routes/admin-users.js'; // Import the admin-users router
// ... other imports and setup

const app = express();

const allowedOrigins = [
	'https://the-huddle.co',
	'https://www.the-huddle.co',
	'http://localhost:5173',
];

app.use((req, res, next) => {
	const origin = req.headers.origin;
	if (origin && allowedOrigins.includes(origin)) {
		res.header('Access-Control-Allow-Origin', origin);
	}
	res.header('Access-Control-Allow-Credentials', 'true');
	res.header(
		'Access-Control-Allow-Methods',
		'GET,POST,PUT,PATCH,DELETE,OPTIONS'
	);
	res.header(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization, X-Requested-With'
	);
	if (req.method === 'OPTIONS') {
		return res.sendStatus(200);
	}
	next();
});

app.use(express.json());

app.get('/api/health', (_req, res) => {
	res.json({
		status: 'ok',
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
	});
});

// ... other app.use() calls

app.use('/api/text-content', textContentRouter);
app.use('/api/admin/users', adminUsersRouter); // Register the admin-users router

// ... rest of server setup and app.listen()

export default app;
