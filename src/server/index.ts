

import express, { Request, Response, ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csurf from 'csurf';
import cookieParser from 'cookie-parser';

import analyticsRoutes from './analyticsRoutes.js';
import auditLogRoutes from './auditLogRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import mfaRoutes from './routes/mfaRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import surveyRoutes from './routes/surveyRoutes.js';
import progressRoutes from './routes/progressRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;
const HEALTH_PATH = '/api/health';

if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
  app.set('trust proxy', 1);
}

// Health check for Railway and infra monitors.
// MUST be registered before CORS/CSRF so probes never get blocked.
app.get(HEALTH_PATH, (_req: Request, res: Response) => {
  res
    .status(200)
    .set('Access-Control-Allow-Origin', '*')
    .json({ status: 'ok', ts: new Date().toISOString(), port: PORT });
});
console.info(`[boot] Registered health route at ${HEALTH_PATH}`);

console.info(`[boot] PORT=${PORT} NODE_ENV=${process.env.NODE_ENV ?? 'undefined'}`);

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

// CORS: allow frontend origin(s) and enable credentials for cookie-based auth
const defaultOrigins = [
  'https://the-huddle.co',
  'https://www.the-huddle.co',
  'https://api.the-huddle.co',
  'http://localhost:5173',
  'http://localhost:4173', // Vite preview
  'http://localhost:8888', // Netlify dev server
];

const envOrigins = process.env.CORS_ALLOWED_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...(envOrigins ?? []), ...defaultOrigins]));
const wildcardOriginMatchers = [/\.netlify\.app$/i];

if (allowedOrigins.length === 0) {
  console.warn('[CORS] No explicit origins configured; falling back to localhost only.');
}

console.info('[CORS] Allowed origins:', allowedOrigins);

const corsOptions: cors.CorsOptions = {
  origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin like curl or mobile apps
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || wildcardOriginMatchers.some((regex) => regex.test(origin))) {
      return callback(null, true);
    }
    console.warn('[CORS] Blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'X-Requested-With',
    'X-Org-Id',
    'X-Organization-Id',
    'X-User-Id',
    'X-User-Role',
  ],
  exposedHeaders: ['Authorization', 'X-Org-Resolved'],
  maxAge: 600,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// CSRF Protection (for non-GET requests)
app.use(csurf({ cookie: true }));

// CSRF token endpoint
app.get('/api/csrf-token', (req: Request, res: Response) => {
  res.json({ csrfToken: req.csrfToken() });
});


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api', courseRoutes);
app.use('/api', surveyRoutes);
app.use('/api', progressRoutes);
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
