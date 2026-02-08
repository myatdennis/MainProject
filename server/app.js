import express from 'express';
import textContentRouter from './routes/textContent.js';
import adminUsersRouter from './routes/admin-users.js';
import healthRouter from './routes/health.js';
import corsMiddleware from './middleware/cors.js';
import { getCookieOptions } from './middleware/cookieOptions.js';
import { env } from './utils/env.js';
import { log } from './utils/logger.js';
import { handleError } from './utils/errorHandler.js';

const redactEnv = (input) => {
  if (!input || typeof input !== 'object') {
    return input;
  }
  return Object.keys(input).reduce((acc, key) => {
    if (/(KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL)/i.test(key)) {
      acc[key] = '***redacted***';
    } else {
      acc[key] = input[key];
    }
    return acc;
  }, {});
};

const app = express();

// Use new CORS middleware
app.use(corsMiddleware);

app.use(express.json());

// Use new health route
app.use('/api', healthRouter);

// ... other app.use() calls ...
app.use('/api/text-content', textContentRouter);
app.use('/api/admin/users', adminUsersRouter);

// Example usage of shared utils
log('info', 'Server started', { env: redactEnv(env) });
app.use((err, req, res, next) => {
  handleError(err, 'Express Middleware');
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
