import express from 'express';
import textContentRouter from './routes/textContent';
// ... other imports and setup

const app = express();
app.use(express.json());

// ... other app.use() calls

app.use('/api/text-content', textContentRouter);

// ... rest of server setup and app.listen()