

import express, { Request, Response, ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csurf from 'csurf';
import cookieParser from 'cookie-parser';

import analyticsRoutes from './analyticsRoutes';
import auditLogRoutes from './auditLogRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(cookieParser());
app.use(express.json());

// CSRF Protection (for non-GET requests)
app.use(csurf({ cookie: true }));

// CSRF token endpoint
app.get('/api/csrf-token', (req: Request, res: Response) => {
  res.json({ csrfToken: req.csrfToken() });
});


// Routes
app.use(analyticsRoutes);
app.use(auditLogRoutes);

// Error handler for CSRF errors
const csrfErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next(err);
};
app.use(csrfErrorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export default app;