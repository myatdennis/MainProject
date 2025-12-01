import express from 'express';
import cors from 'cors';
import textContentRouter from './routes/textContent.js';
import adminUsersRouter from './routes/admin-users.js'; // Import the admin-users router
// ... other imports and setup

const app = express();
app.use(express.json());

// CORS configuration for the public server
const allowedOrigins = [
	'https://the-huddle.co',
	'https://www.the-huddle.co',
	'http://localhost:5173',
];

const corsOptions = {
	origin(origin, callback) {
		if (!origin) return callback(null, true);
		if (allowedOrigins.includes(origin)) return callback(null, true);
		console.warn('[CORS] Blocked origin:', origin);
		return callback(new Error('Not allowed by CORS'));
	},
	credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ... other app.use() calls

app.use('/api/text-content', textContentRouter);
app.use('/api/admin/users', adminUsersRouter); // Register the admin-users router

// ... rest of server setup and app.listen()

export default app;
