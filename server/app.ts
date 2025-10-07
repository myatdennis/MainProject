import express from 'express';
import textContentRouter from './routes/textContent';
import aiRouter from './routes/ai';
// ... other imports and setup

const app = express();
app.use(express.json());

// ... other app.use() calls

app.use('/api/text-content', textContentRouter);
app.use('/api/ai', aiRouter);

// ... rest of server setup and app.listen()