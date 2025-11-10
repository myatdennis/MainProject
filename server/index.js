// (Removed initial lightweight dev server stub in favor of the full server below)
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { WebSocketServer } from 'ws';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import {
  moduleCreateSchema,
  modulePatchSchema as modulePatchValidator,
  lessonCreateSchema,
  lessonPatchSchema as lessonPatchValidator,
  moduleReorderSchema,
  lessonReorderSchema,
  pickId,
  pickOrder,
  validateOr400,
  courseUpsertSchema,
} from './validators.js';

// Import auth routes and middleware
import authRoutes from './routes/auth.js';
import adminAnalyticsRoutes from './routes/admin-analytics.js';
import adminAnalyticsExport from './routes/admin-analytics-export.js';
import adminAnalyticsSummary from './routes/admin-analytics-summary.js';
import { apiLimiter, securityHeaders } from './middleware/auth.js';
import { setDoubleSubmitCSRF, getCSRFToken } from './middleware/csrf.js';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent storage file for demo mode
const STORAGE_FILE = path.join(__dirname, 'demo-data.json');
// Safety guard to avoid loading extremely large demo files that could trigger OOM (exit 137)
const MAX_DEMO_FILE_BYTES = parseInt(process.env.DEMO_DATA_MAX_BYTES || '', 10) || 25 * 1024 * 1024; // 25MB default

// Helper functions for persistent storage
function loadPersistedData() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      try {
        const stat = fs.statSync(STORAGE_FILE);
        if (stat.size > MAX_DEMO_FILE_BYTES) {
          console.warn(`demo-data.json is too large (${(stat.size/1e6).toFixed(1)}MB). Skipping load to prevent high memory usage. Set DEMO_DATA_MAX_BYTES to adjust.`);
          return { courses: [] };
        }
      } catch {}
      const data = fs.readFileSync(STORAGE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading persisted data:', error);
  }
  return { courses: new Map(), modules: new Map(), lessons: new Map() };
}

function savePersistedData(data) {
  try {
    // Convert Maps to arrays for JSON serialization
    // Modules and lessons are nested inside courses, not separate Maps
    const serializable = {
      courses: Array.from(data.courses.entries())
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(serializable, null, 2), 'utf8');
    console.log(`📁 Persisted ${data.courses.size} course(s) to ${STORAGE_FILE}`);
  } catch (error) {
    console.error('Error saving persisted data:', error);
  }
}

const app = express();
// Prefer explicit PORT (e.g. 8888) to align with Vite proxy and VITE_API_BASE_URL; default to 8888 instead of 8787
const port = process.env.PORT || 8888;
console.log(`[server] Using port ${port} (override via PORT env)`);

app.use(express.json({ limit: '10mb' }));

// Security middleware
app.use(cookieParser());
app.use(securityHeaders);
app.use(setDoubleSubmitCSRF);
app.use('/api', apiLimiter);

// Expose CSRF token endpoint for clients and scripts that use the double-submit cookie pattern
app.get('/api/auth/csrf', getCSRFToken);

// Dev fallback: allow in-memory server behavior when Supabase isn't configured.
// Enabled by default in non-production unless DEV_FALLBACK=false is set.
const DEV_FALLBACK = (process.env.DEV_FALLBACK || '').toLowerCase() !== 'false' && (process.env.NODE_ENV || '').toLowerCase() !== 'production';

// In E2E/dev mode, enable permissive CORS so the Vite dev origin (5174) can call the API (8787)
if (process.env.E2E_TEST_MODE === 'true' || DEV_FALLBACK) {
  app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id, X-User-Role, X-Org-Id, x-csrf-token');
    res.header('Access-Control-Expose-Headers', 'x-request-id');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });
}

// In production, restrict CORS to an allowlist provided via CORS_ALLOWED_ORIGINS
// Example: CORS_ALLOWED_ORIGINS="https://your-site.netlify.app,https://www.yourdomain.com"
if (!(process.env.E2E_TEST_MODE === 'true' || DEV_FALLBACK)) {
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // If not configured, default to no special handling (no wildcard) to be conservative
  if (allowedOrigins.length > 0) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      const isAllowed = origin && allowedOrigins.includes(origin);

      if (isAllowed) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.header(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, X-User-Id, X-User-Role, X-Org-Id, x-csrf-token'
        );
        res.header('Access-Control-Expose-Headers', 'x-request-id');
      }

      if (req.method === 'OPTIONS') {
        // If origin not allowed, return 403 to make it explicit during setup
        return res.status(isAllowed ? 204 : 403).end();
      }
      next();
    });
  }
}

// Basic request logging with request_id and timing
app.use((req, res, next) => {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();
  res.setHeader('x-request-id', requestId);
  req.requestId = requestId;
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${ms}ms [${requestId}]`);
  });
  next();
});

// Optional periodic memory usage logging (enable with LOG_MEMORY=true)
if ((process.env.LOG_MEMORY || '').toLowerCase() === 'true') {
  setInterval(() => {
    const mu = process.memoryUsage();
    const fmt = (n) => (n / 1e6).toFixed(1);
    console.log(`[mem] rss=${fmt(mu.rss)}MB heapUsed=${fmt(mu.heapUsed)}MB heapTotal=${fmt(mu.heapTotal)}MB ext=${fmt(mu.external)}MB`);
  }, 30000);
}

// Text content endpoints used by the content editor (local file-backed)
const contentPath = path.join(__dirname, '../src/content/textContent.json');

app.get('/api/text-content', (_req, res) => {
  fs.readFile(contentPath, 'utf8', (err, data) => {
    if (err) {
      res.status(500).send('Failed to load content');
      return;
    }
    try {
      const obj = JSON.parse(data);
      const items = Object.entries(obj).map(([key, value]) => ({ key, value }));
      res.json(items);
    } catch (e) {
      res.status(500).send('Invalid content JSON');
    }
  });
});

app.put('/api/text-content', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  const contentJson = {};
  for (const item of items) {
    if (item && typeof item.key === 'string') {
      contentJson[item.key] = item.value;
    }
  }
  fs.writeFile(contentPath, JSON.stringify(contentJson, null, 2), (err) => {
    if (err) {
      res.status(500).send('Failed to save content');
      return;
    }
    res.json({ success: true });
  });
});

// Auth routes (login, register, refresh, logout)
app.use('/api/auth', authRoutes);

// Admin analytics endpoints (aggregates, exports, AI summary)
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/analytics/export', adminAnalyticsExport);
app.use('/api/admin/analytics/summary', adminAnalyticsSummary);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

// Lightweight in-memory fallback used for local E2E runs when Supabase is not configured.
const E2E_TEST_MODE = process.env.E2E_TEST_MODE === 'true';

// Load persisted data if available
const persistedData = loadPersistedData();

const e2eStore = {
  courses: new Map(persistedData.courses || []), // id -> { id, slug, title, description, status, version, published_at, meta_json, modules: [{ id, title, description, order_index, lessons: [...] }] }
  assignments: [],
  courseProgress: new Map(), // key `${user_id}:${course_id}` -> { user_id, course_id, percent, status, time_spent_s, updated_at }
  lessonProgress: new Map(), // key `${user_id}:${lesson_id}` -> { user_id, lesson_id, percent, status, time_spent_s, resume_at_s, updated_at }
  progressEvents: new Set(), // idempotency keys (client_event_id)
  // generic idempotency keys for demo mode: map of id -> resourceId|null
  // null indicates the key was reserved/in-flight; a string value indicates the resource id produced
  idempotencyKeys: {},
  analyticsEvents: [], // stored analytics events in demo/E2E mode
};

// Log loaded courses
if (e2eStore.courses.size > 0) {
  console.log(`✅ Loaded ${e2eStore.courses.size} course(s) from persistent storage`);
  for (const [id, course] of e2eStore.courses.entries()) {
    console.log(`   - ${course.title} (${id})`);
  }
} else {
  // Seed a demo course if no courses exist
  console.log('📚 No courses found. Seeding demo course...');
  const demoCourse = {
    id: 'foundations',
    slug: 'foundations-of-inclusive-leadership',
    title: 'Foundations of Inclusive Leadership',
    description: 'Learn the fundamentals of inclusive leadership through interactive lessons, including TED Talks, quizzes, and practical frameworks.',
    status: 'published',
    version: 1,
    published_at: new Date().toISOString(),
    thumbnail: '/api/placeholder/400/300',
    difficulty: 'Beginner',
    duration: '2 hours',
    instructorName: 'Dr. Sarah Chen',
    estimatedDuration: 7200,
    keyTakeaways: [
      'Understand the core principles of inclusive leadership',
      'Learn how vulnerability strengthens leadership',
      'Build psychological safety in teams',
      'Apply practical leadership frameworks'
    ],
    meta_json: {
      tags: ['leadership', 'inclusion', 'management', 'professional development'],
      category: 'Leadership',
      level: 'beginner'
    },
    modules: [
      {
        id: 'mod-1',
        course_id: 'foundations',
        title: 'Introduction to Leadership',
        description: 'Core concepts and foundations',
        order_index: 0,
        lessons: [
          {
            id: 'lesson-video',
            module_id: 'mod-1',
            title: 'The Power of Vulnerability',
            description: 'Watch this inspiring TED Talk by Brené Brown',
            type: 'video',
            order_index: 0,
            duration_s: 1200,
            content_json: {
              videoUrl: 'https://www.ted.com/talks/brene_brown_the_power_of_vulnerability',
              videoType: 'ted'
            },
            completion_rule_json: { requiredPercent: 85 }
          },
          {
            id: 'lesson-quiz',
            module_id: 'mod-1',
            title: 'Leadership Knowledge Check',
            description: 'Test your understanding',
            type: 'quiz',
            order_index: 1,
            duration_s: 300,
            content_json: {
              questions: [
                {
                  id: 'q1',
                  question: 'What is the primary role of an inclusive leader?',
                  options: [
                    { id: 'a', text: 'To make all decisions alone' },
                    { id: 'b', text: 'To create an environment where all voices are heard' },
                    { id: 'c', text: 'To maintain strict hierarchy' },
                    { id: 'd', text: 'To avoid difficult conversations' }
                  ],
                  correctAnswer: 'b'
                },
                {
                  id: 'q2',
                  question: 'Which quality is essential for effective leadership?',
                  options: [
                    { id: 'a', text: 'Vulnerability' },
                    { id: 'b', text: 'Perfectionism' },
                    { id: 'c', text: 'Control' },
                    { id: 'd', text: 'Distance' }
                  ],
                  correctAnswer: 'a'
                }
              ]
            },
            completion_rule_json: { requiredScore: 70 }
          },
          {
            id: 'lesson-text',
            module_id: 'mod-1',
            title: 'Leadership Principles',
            description: 'Core principles of effective leadership',
            type: 'text',
            order_index: 2,
            duration_s: 600,
            content_json: {
              body: '# Leadership Principles\n\n## 1. Lead with Empathy\n\nEmpathy is the foundation of inclusive leadership...\n\n## 2. Foster Psychological Safety\n\nCreate an environment where team members feel safe...\n\n## 3. Embrace Vulnerability\n\nAs Brené Brown teaches, vulnerability is not weakness...'
            },
            completion_rule_json: null
          },
          {
            id: 'lesson-resource',
            module_id: 'mod-1',
            title: 'Leadership Framework Guide',
            description: 'Download the comprehensive leadership framework',
            type: 'resource',
            order_index: 3,
            duration_s: 0,
            content_json: {
              fileUrl: '/resources/leadership-framework.pdf',
              fileType: 'pdf',
              fileSize: '2.4 MB',
              fileName: 'Leadership Framework Guide.pdf'
            },
            completion_rule_json: null
          }
        ]
      }
    ]
  };
  e2eStore.courses.set('foundations', demoCourse);
  savePersistedData(e2eStore);
  console.log('✅ Demo course seeded successfully');
}

// E2E helpers
const e2eFindCourse = (identifier) => {
  if (!identifier) return null;
  const byId = e2eStore.courses.get(identifier);
  if (byId) return byId;
  const lower = String(identifier).toLowerCase();
  for (const course of e2eStore.courses.values()) {
    if ((course.slug && String(course.slug).toLowerCase() === lower) || String(course.id).toLowerCase() === lower) {
      return course;
    }
  }
  return null;
};

const e2eFindModule = (moduleId) => {
  for (const course of e2eStore.courses.values()) {
    const mod = (course.modules || []).find((m) => String(m.id) === String(moduleId));
    if (mod) return { course, module: mod };
  }
  return null;
};

const e2eFindLesson = (lessonId) => {
  for (const course of e2eStore.courses.values()) {
    for (const mod of course.modules || []) {
      const lesson = (mod.lessons || []).find((l) => String(l.id) === String(lessonId));
      if (lesson) return { course, module: mod, lesson };
    }
  }
  return null;
};

// Helper to persist data after any modification
const persistE2EStore = () => {
  if (DEV_FALLBACK || E2E_TEST_MODE) {
    savePersistedData(e2eStore);
  }
};


const ensureSupabase = (res) => {
  if (!supabase) {
    // Allow tests to run with an in-memory fallback when explicitly enabled
    if (E2E_TEST_MODE || DEV_FALLBACK) return true;
    res.status(500).json({ error: 'Supabase service credentials not configured on server' });
    return false;
  }
  return true;
};

const writableMembershipRoles = new Set(['owner', 'admin', 'editor', 'manager']);

const getRequestContext = (req) => {
  const userIdHeader = req.get('x-user-id');
  const userRoleHeader = req.get('x-user-role');
  const userId = userIdHeader && userIdHeader.trim().length > 0 ? userIdHeader.trim() : null;
  const userRole = userRoleHeader && userRoleHeader.trim().length > 0 ? userRoleHeader.trim().toLowerCase() : null;
  return { userId, userRole };
};

const requireUserContext = (req, res) => {
  const { userId, userRole } = getRequestContext(req);
  if (userRole === 'admin') {
    return { userId, userRole };
  }
  if (!userId) {
    res.status(401).json({ error: 'User authentication required' });
    return null;
  }
  return { userId, userRole };
};

const fetchMembership = async (orgId, userId) => {
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

const requireOrgAccess = async (req, res, orgId, { write = false } = {}) => {
  const context = getRequestContext(req);
  if (context.userRole === 'admin') {
    return { userId: context.userId, role: 'admin' };
  }

  if (!context.userId) {
    res.status(401).json({ error: 'User authentication required' });
    return null;
  }

  try {
    // E2E in-memory fallback: when Supabase isn't configured but tests enabled,
    // operate against the in-memory e2eStore instead of calling Supabase.
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      const existingAssignments = [];
      const toInsert = [];

      for (const item of desired) {
        const found = e2eStore.assignments.find((a) => {
          if (!a) return false;
          if (String(a.organization_id) !== String(item.organization_id)) return false;
          if (String(a.course_id) !== String(item.course_id)) return false;
          if (!a.active) return false;
          if (a.user_id === null && item.user_id === null) return true;
          if (a.user_id === null || item.user_id === null) return false;
          return String(a.user_id) === String(item.user_id);
        });

        if (found) {
          existingAssignments.push(found);
        } else {
          toInsert.push(item);
        }
      }

      const inserted = [];
      for (const it of toInsert) {
        const newAsn = Object.assign({}, it, {
          id: `e2e-asn-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          created_at: new Date().toISOString()
        });
        e2eStore.assignments.push(newAsn);
        inserted.push(newAsn);
      }

      const assignments = [...existingAssignments, ...inserted];

      // Broadcast assignment events for newly created assignments only
      try {
        for (const asn of inserted) {
          const orgId = asn.organization_id || asn.org_id || organization_id || null;
          const topicOrg = orgId ? `assignment:org:${orgId}` : 'assignment:org:global';
          const payload = { type: 'assignment_created', data: asn, timestamp: Date.now() };
          broadcastToTopic(topicOrg, payload);
          if (asn.user_id) {
            broadcastToTopic(`assignment:user:${String(asn.user_id).toLowerCase()}`, payload);
          }
        }
      } catch (bErr) {
        console.warn('Failed to broadcast assignment events', bErr);
      }

      res.status(201).json({ data: assignments });
      return;
    }
    // If running in E2E test mode without Supabase, assume org access for convenience
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      return { userId: context.userId, role: 'admin' };
    }

    const membership = await fetchMembership(orgId, context.userId);
    if (!membership) {
      res.status(403).json({ error: 'Organization membership required' });
      return null;
    }

    const memberRole = (membership.role || 'member').toLowerCase();
    if (write && !writableMembershipRoles.has(memberRole)) {
      res.status(403).json({ error: 'Insufficient organization permissions' });
      return null;
    }

    return { userId: context.userId, role: memberRole };
  } catch (error) {
    console.error(`Failed to verify membership for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to verify organization access' });
    return null;
  }
};

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (value && typeof value === 'object') {
    return [value];
  }
  return [];
};

const toStrategicPlan = (row) => ({
  id: row.id,
  orgId: row.org_id,
  content: row.content ?? '',
  createdAt: row.created_at,
  createdBy: row.created_by ?? 'System',
  metadata: row.metadata ?? {}
});

const toSessionNote = (row) => ({
  id: row.id,
  orgId: row.org_id,
  title: row.title,
  body: row.body ?? '',
  date: row.note_date ? new Date(row.note_date).toISOString() : row.created_at,
  tags: safeArray(row.tags),
  attachments: safeArray(row.attachments),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by ?? 'System'
});

const toActionItem = (row) => ({
  id: row.id,
  orgId: row.org_id,
  title: row.title,
  description: row.description ?? '',
  assignee: row.assignee ?? undefined,
  dueDate: row.due_at ? new Date(row.due_at).toISOString() : undefined,
  status: row.status ?? 'Not Started',
  metadata: row.metadata ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const actionStatusOrder = {
  'Not Started': 0,
  'In Progress': 1,
  Completed: 2
};

const sortActionItems = (items) =>
  items.slice().sort((a, b) => {
    const statusDiff = (actionStatusOrder[a.status] ?? 3) - (actionStatusOrder[b.status] ?? 3);
    if (statusDiff !== 0) return statusDiff;
    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return dueA - dueB;
  });

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    supabaseConfigured: Boolean(supabase),
    timestamp: new Date().toISOString(),
    uptime_s: Math.round(process.uptime()),
  });
});

// Simple in-memory topic subscriptions for WS clients
const topicSubscribers = new Map(); // topic -> Set(ws)

function subscribeClientToTopic(ws, topic) {
  if (!topicSubscribers.has(topic)) topicSubscribers.set(topic, new Set());
  topicSubscribers.get(topic).add(ws);
}

function unsubscribeClientFromTopic(ws, topic) {
  if (!topicSubscribers.has(topic)) return;
  topicSubscribers.get(topic).delete(ws);
}

function broadcastToTopic(topic, payload) {
  const set = topicSubscribers.get(topic);
  const message = JSON.stringify(payload);
  if (!set) return;
  for (const ws of set) {
    try {
      if (ws.readyState === ws.OPEN) ws.send(message);
    } catch (err) {
      console.warn('Failed to send WS message', err);
    }
  }
}

// Simple in-memory token bucket limiter per key
const createRateLimiter = ({ tokensPerInterval = 10, intervalMs = 1000 } = {}) => {
  const buckets = new Map();
  return (key) => {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: tokensPerInterval, last: now };
      buckets.set(key, bucket);
    }
    const elapsed = now - bucket.last;
    const refill = Math.floor((elapsed / intervalMs) * tokensPerInterval);
    if (refill > 0) {
      bucket.tokens = Math.min(tokensPerInterval, bucket.tokens + refill);
      bucket.last = now;
    }
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  };
};

const checkProgressLimit = createRateLimiter({ tokensPerInterval: 8, intervalMs: 1000 });

// ============================================================================
// Authentication Endpoints
// ============================================================================

// Authentication handler function
const handleLogin = async (req, res) => {
  const { email, password, type } = req.body || {};

  console.log('[AUTH] Login attempt:', { email, type, hasSupabase: Boolean(supabase), E2E_TEST_MODE, DEV_FALLBACK });

  if (!email || !password) {
    res.status(400).json({ 
      error: 'Email and password are required',
      errorType: 'validation_error'
    });
    return;
  }

  // Demo/E2E mode - accept any login with test credentials
  // Use demo mode if: E2E_TEST_MODE is set, OR we're in dev fallback mode
  const useDemoMode = E2E_TEST_MODE || DEV_FALLBACK;
  
  if (useDemoMode) {
    console.log('[AUTH] Using demo mode authentication');
    // Test credentials for demo
    const validLogins = {
      'user@pacificcoast.edu': { password: 'user123', role: 'learner', name: 'Demo User' },
      'admin@thehuddleco.com': { password: 'admin123', role: 'admin', name: 'Admin User' },
      'demo@example.com': { password: 'demo', role: 'learner', name: 'Demo Learner' }
    };

    const user = validLogins[email.toLowerCase()];
    
    if (user && user.password === password) {
      const userData = {
        id: `demo-${email.split('@')[0]}`,
        email: email.toLowerCase(),
        name: user.name,
        role: user.role,
        organizationId: 'demo-org'
      };

      res.json({
        success: true,
        user: userData,
        accessToken: `demo-token-${Date.now()}`,
        refreshToken: `demo-refresh-${Date.now()}`,
        expiresAt: Date.now() + 86400000 // 24 hours
      });
      return;
    }

    res.status(401).json({
      error: 'Invalid credentials',
      errorType: 'invalid_credentials'
    });
    return;
  }

  // Supabase authentication (if configured)
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      res.status(401).json({
        error: error.message || 'Authentication failed',
        errorType: 'invalid_credentials'
      });
      return;
    }

    res.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || data.user.email,
        role: type === 'admin' ? 'admin' : 'learner',
        organizationId: data.user.user_metadata?.organization_id || null
      },
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Authentication service error',
      errorType: 'network_error'
    });
  }
};

// Register login endpoint at both paths for compatibility
app.post('/api/auth/login', handleLogin);
app.post('/login', handleLogin); // Legacy path

// Token refresh endpoint
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};

  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  // Demo mode - just issue new tokens
  if (E2E_TEST_MODE || DEV_FALLBACK || !supabase) {
    res.json({
      accessToken: `demo-token-${Date.now()}`,
      refreshToken: `demo-refresh-${Date.now()}`,
      expiresAt: Date.now() + 86400000
    });
    return;
  }

  // Supabase refresh
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Forgot password endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    res.status(400).json({ error: 'Email required' });
    return;
  }

  // Demo mode - just acknowledge
  if (E2E_TEST_MODE || DEV_FALLBACK || !supabase) {
    res.json({ 
      success: true, 
      message: 'Password reset email sent (demo mode - not actually sent)' 
    });
    return;
  }

  // Supabase password reset
  if (!ensureSupabase(res)) return;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ 
      success: true, 
      message: 'Password reset email sent' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// HTTP endpoint to broadcast events. Secured by a server-only API key (BROADCAST_API_KEY).
// If BROADCAST_API_KEY is not set (dev), fallback to the previous x-user-role=admin header check.
app.post('/api/broadcast', (req, res) => {
  const { type, topic, data } = req.body || {};

  const broadcastApiKey = process.env.BROADCAST_API_KEY || null;

  // If a server broadcast API key is configured, require it via Authorization: Bearer <key>
  // or the x-broadcast-api-key header. This keeps the endpoint callable only from trusted
  // backend services. If not set, fall back to the legacy admin header check (dev convenience).
  if (broadcastApiKey) {
    const auth = (req.get('authorization') || '').trim();
    const headerKey = (req.get('x-broadcast-api-key') || '').trim();
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth;
    if (token !== broadcastApiKey && headerKey !== broadcastApiKey) {
      res.status(403).json({ error: 'Invalid broadcast API key' });
      return;
    }
  } else {
    const userRole = (req.get('x-user-role') || '').toLowerCase();
    if (userRole !== 'admin') {
      res.status(403).json({ error: 'Admin role required to broadcast' });
      return;
    }
  }

  if (!type) {
    res.status(400).json({ error: 'type is required' });
    return;
  }

  const payload = { type, data, timestamp: Date.now() };
  if (topic) broadcastToTopic(topic, payload);
  else {
    // broadcast to all topics
    for (const t of topicSubscribers.keys()) broadcastToTopic(t, payload);
  }

  res.json({ ok: true });
});

// Expose broadcast helper to other server modules
app.locals.broadcastToTopic = broadcastToTopic;

app.get('/api/admin/courses', async (_req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    try {
      const data = Array.from(e2eStore.courses.values()).map((c) => ({
        id: c.id,
        slug: c.slug ?? c.id,
        title: c.title,
        description: c.description ?? null,
        status: c.status ?? 'draft',
        version: c.version ?? 1,
        meta_json: c.meta_json ?? {},
        published_at: c.published_at ?? null,
        thumbnail: c.thumbnail ?? null,
        difficulty: c.difficulty ?? null,
        duration: c.duration ?? null,
        instructorName: c.instructorName ?? null,
        estimatedDuration: c.estimatedDuration ?? null,
        keyTakeaways: c.keyTakeaways ?? [],
        modules: (c.modules || []).map((m) => ({
          id: m.id,
          course_id: c.id,
          title: m.title,
          description: m.description ?? null,
          order_index: m.order_index ?? m.order ?? 0,
          lessons: (m.lessons || []).map((l) => ({
            id: l.id,
            module_id: m.id,
            title: l.title,
            description: l.description ?? null,
            type: l.type,
            order_index: l.order_index ?? l.order ?? 0,
            duration_s: l.duration_s ?? null,
            content_json: l.content_json ?? l.content ?? {},
            completion_rule_json: l.completion_rule_json ?? l.completionRule ?? null,
          })),
        })),
      }));
      res.json({ data });
      return;
    } catch (err) {
      console.error('E2E fetch courses failed', err);
      res.status(500).json({ error: 'Unable to fetch courses' });
      return;
    }
  }

  if (!ensureSupabase(res)) return;
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
      .order('created_at', { ascending: false })
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: 'modules.lessons' });

    if (error) throw error;

    // Prefer transactional RPC if available
    try {
      const rpcPayload = {
        id: course.id ?? null,
        slug: course.slug ?? null,
        title: course.title || course.name,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        version: course.version ?? 1,
        org_id: course.org_id ?? course.organizationId ?? null,
        meta_json: meta,
      };
      const rpcRes = await supabase.rpc('upsert_course_full', { p_course: rpcPayload, p_modules: modules });
      if (!rpcRes.error && rpcRes.data) {
        const sel = await supabase
          .from('courses')
          .select('*, modules(*, lessons(*))')
          .eq('id', rpcRes.data)
          .single();
        if (sel.error) throw sel.error;
        // If an idempotency key was provided, record the resulting resource id
        if (idempotencyKey) {
          try {
            await supabase.from('idempotency_keys').update({ resource_id: sel.data?.id }).eq('id', idempotencyKey);
          } catch (updErr) {
            console.warn('Failed to update idempotency_keys with resource id', updErr);
          }
        }
        res.status(201).json({ data: sel.data });
        return;
      }
    } catch (rpcErr) {
      console.warn('RPC upsert_course_full failed, falling back to client-side sequence:', rpcErr);
    }
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch courses:', error);
    res.status(500).json({ error: 'Unable to fetch courses' });
  }
});

app.post('/api/admin/courses', async (req, res) => {
  // Validate incoming payload (accepting existing client shape)
  const valid = validateOr400(courseUpsertSchema, req, res);
  if (!valid) return;
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { course, modules = [] } = req.body || {};
    if (!course?.title) {
      res.status(400).json({ error: 'Course title is required' });
      return;
    }
    try {
      // Demo-mode idempotency: respect client-provided idempotency keys in E2E/demo fallback
      const demoIdempotencyKey = req.body?.idempotency_key ?? req.body?.client_event_id ?? null;
      if (demoIdempotencyKey) {
        // If we've already seen this idempotency key, return the previously-created resource if available
        const existingResourceId = e2eStore.idempotencyKeys[demoIdempotencyKey];
        if (existingResourceId) {
          const existingCourse = e2eStore.courses.get(existingResourceId);
          if (existingCourse) {
            res.json({ data: existingCourse, idempotent: true });
            return;
          }
          // Key exists but no resource recorded yet: indicate conflict/processing
          res.status(409).json({ error: 'idempotency_conflict', message: 'Duplicate idempotency key (processing)' });
          return;
        }
        // Reserve the idempotency key (null = in-flight)
        e2eStore.idempotencyKeys[demoIdempotencyKey] = null;
      }

      // Idempotent upsert by id, slug, or external_id (stored in meta_json)
      let existingId = null;
      const incomingSlug = course.slug ?? null;
      const incomingExternalId = (course.external_id ?? course.meta?.external_id ?? null) || null;
      if (!course.id) {
        for (const c of e2eStore.courses.values()) {
          const cSlug = c.slug ?? c.id;
          const cExternal = c.meta_json?.external_id ?? null;
          if (incomingSlug && String(cSlug).toLowerCase() === String(incomingSlug).toLowerCase()) {
            existingId = c.id;
            break;
          }
          if (incomingExternalId && cExternal && String(cExternal) === String(incomingExternalId)) {
            existingId = c.id;
            break;
          }
        }
      }
      const id = course.id ?? existingId ?? `e2e-course-${Date.now()}`;
      const courseObj = {
        id,
        slug: course.slug ?? id,
        title: course.title,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        version: course.version ?? 1,
        meta_json: { ...(course.meta ?? {}), ...(incomingExternalId ? { external_id: incomingExternalId } : {}) },
        published_at: null,
        modules: [],
      };
      const modulesArr = modules || [];
      for (const [moduleIndex, module] of modulesArr.entries()) {
        const moduleId = module.id ?? `e2e-mod-${Date.now()}-${moduleIndex}`;
        const moduleObj = {
          id: moduleId,
          course_id: id,
          title: module.title,
          description: module.description ?? null,
          order_index: module.order_index ?? moduleIndex,
          lessons: [],
        };
        const lessons = module.lessons || [];
        for (const [lessonIndex, lesson] of lessons.entries()) {
          const lessonId = lesson.id ?? `e2e-less-${Date.now()}-${moduleIndex}-${lessonIndex}`;
          const lessonObj = {
            id: lessonId,
            module_id: moduleId,
            title: lesson.title,
            description: lesson.description ?? null,
            type: lesson.type,
            order_index: lesson.order_index ?? lessonIndex,
            duration_s: lesson.duration_s ?? null,
            content_json: lesson.content_json ?? lesson.content ?? {},
            completion_rule_json: lesson.completion_rule_json ?? lesson.completionRule ?? null,
          };
          moduleObj.lessons.push(lessonObj);
        }
        courseObj.modules.push(moduleObj);
      }
      e2eStore.courses.set(id, courseObj);

      // If an idempotency key was provided in demo mode, record the resulting resource id
      if (demoIdempotencyKey) {
        try {
          e2eStore.idempotencyKeys[demoIdempotencyKey] = id;
        } catch (err) {
          console.warn('Failed to record demo idempotency mapping', err);
        }
      }

      // Save to persistent storage
      persistE2EStore();
      console.log(`✅ Saved course "${courseObj.title}" to persistent storage`);

      res.status(201).json({ data: courseObj });
      return;
    } catch (error) {
      console.error('E2E upsert course failed:', error);
      res.status(500).json({ error: 'Unable to save course' });
      return;
    }
  }

  if (!ensureSupabase(res)) return;

  const { course, modules = [] } = req.body || {};
  if (!course?.title) {
    res.status(400).json({ error: 'Course title is required' });
    return;
  }

  try {
    const meta = course.meta ?? {};
    // Optional optimistic version check to avoid overwriting newer versions
    if (course.id) {
      const existing = await supabase.from('courses').select('id, version').eq('id', course.id).maybeSingle();
      if (existing.error) throw existing.error;
      const currVersion = existing.data?.version ?? null;
      if (currVersion !== null && typeof course.version === 'number' && course.version < currVersion) {
        res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${currVersion}` });
        return;
      }
    }

    // Optional idempotency: if the client provided an idempotency key (or client_event_id),
    // record it in the `idempotency_keys` table to avoid duplicate processing on retries.
    // If the key already exists, treat as idempotent and return a 409 indicating duplicate.
    const idempotencyKey = req.body?.idempotency_key ?? req.body?.client_event_id ?? null;
    if (idempotencyKey) {
      try {
        await supabase.from('idempotency_keys').insert({ id: idempotencyKey, key_type: 'course_upsert', resource_id: null, payload: { course: course, modules: modules } });
      } catch (ikErr) {
        // Duplicate idempotency key: try to fetch the recorded idempotency row and return
        console.warn(`Idempotency key ${idempotencyKey} already exists`);
        try {
          const { data: existing, error: fetchErr } = await supabase.from('idempotency_keys').select('*').eq('id', idempotencyKey).maybeSingle();
          if (!fetchErr && existing) {
            if (existing.resource_id) {
              // If we have a resource_id, try to fetch and return the created resource
              const { data: courseRow, error: courseFetchErr } = await supabase
                .from('courses')
                .select('*, modules(*, lessons(*))')
                .eq('id', existing.resource_id)
                .maybeSingle();
              if (!courseFetchErr && courseRow) {
                res.status(200).json({ data: courseRow, idempotent: true });
                return;
              }
              // Resource id present but resource not yet queryable
              res.status(409).json({ error: 'idempotency_conflict', message: 'Duplicate idempotency key (resource not available yet)' });
              return;
            }
            // Key exists but resource_id not set yet; indicate conflict/processing
            res.status(409).json({ error: 'idempotency_conflict', message: 'Duplicate idempotency key (processing)' });
            return;
          }
        } catch (fetchErr) {
          console.warn('Failed to lookup existing idempotency key row', fetchErr);
        }
        // Fallback response
        res.status(409).json({ error: 'idempotency_conflict', message: 'Duplicate idempotency key' });
        return;
      }
    }

    // If Supabase supports the upsert_course_full RPC, try a single transactional upsert
    try {
      const organizationId = course.org_id ?? course.organizationId ?? null;
      const rpcPayload = {
        id: course.id ?? undefined,
        slug: course.slug ?? undefined,
        title: course.title || course.name,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        version: course.version ?? 1,
        organization_id: organizationId,
        meta_json: meta,
      };
      const rpcRes = await supabase.rpc('upsert_course_full', { p_course: rpcPayload, p_modules: modules });
      if (!rpcRes.error && rpcRes.data) {
        const sel = await supabase
          .from('courses')
          .select('*, modules(*, lessons(*))')
          .eq('id', rpcRes.data)
          .single();
        if (sel.error) throw sel.error;
        res.status(201).json({ data: sel.data });
        return;
      }
    } catch (rpcErr) {
      console.warn('RPC upsert_course_full failed, falling back to client-side sequence:', rpcErr);
    }

    // Upsert course row first to obtain courseRow.id
    const organizationId = course.org_id ?? course.organizationId ?? null;
    const upsertPayload = {
      id: course.id ?? undefined,
      slug: course.slug ?? undefined,
      title: course.title || course.name,
      description: course.description ?? null,
      status: course.status ?? 'draft',
      version: course.version ?? 1,
      organization_id: organizationId,
      meta_json: meta,
    };

    const courseRes = await supabase
      .from('courses')
      .upsert(upsertPayload)
      .select('*')
      .single();

    if (courseRes.error) throw courseRes.error;
    const courseRow = courseRes.data;

    // E2E fallback when Supabase isn't configured: keep an in-memory course store
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      const id = course.id ?? `e2e-course-${Date.now()}`;
      const courseObj = {
        id,
        organization_id: course.organizationId ?? null,
        slug: course.slug ?? id,
        title: course.title,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        version: course.version ?? 1,
        meta_json: meta,
        published_at: meta.published_at ?? null,
        due_date: meta.due_date ?? null,
        modules: []
      };

      const modulesArr = modules || [];
      for (const [moduleIndex, module] of modulesArr.entries()) {
        const moduleId = module.id ?? `e2e-mod-${Date.now()}-${moduleIndex}`;
        const moduleObj = {
          id: moduleId,
          course_id: id,
          order_index: module.order_index ?? moduleIndex,
          title: module.title,
          description: module.description ?? null,
          lessons: []
        };

        const lessons = module.lessons || [];
        for (const [lessonIndex, lesson] of lessons.entries()) {
          const lessonId = lesson.id ?? `e2e-less-${Date.now()}-${moduleIndex}-${lessonIndex}`;
          const lessonObj = {
            id: lessonId,
            module_id: moduleId,
            order_index: lesson.order_index ?? lessonIndex,
            type: lesson.type,
            title: lesson.title,
            description: lesson.description ?? null,
            duration_s: lesson.duration_s ?? null,
            content_json: lesson.content_json ?? {},
            completion_rule_json: lesson.completion_rule_json ?? null
          };
          moduleObj.lessons.push(lessonObj);
        }

        courseObj.modules.push(moduleObj);
      }

      e2eStore.courses.set(id, courseObj);

      res.status(201).json({ data: courseObj });
      return;
    }

    const incomingModuleIds = modules.map((module) => module.id).filter(Boolean);
    if (incomingModuleIds.length > 0) {
      const { data: existingModules } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseRow.id);

      const modulesToDelete = (existingModules || [])
        .map((row) => row.id)
        .filter((id) => !incomingModuleIds.includes(id));

      if (modulesToDelete.length > 0) {
        await supabase.from('modules').delete().in('id', modulesToDelete);
      }

      for (const [moduleIndex, module] of modules.entries()) {
        const { data: moduleRow, error: moduleError } = await supabase
          .from('modules')
          .upsert({
            id: module.id,
            course_id: courseRow.id,
            order_index: module.order_index ?? moduleIndex,
            title: module.title,
            description: module.description ?? null
          })
          .select('*')
          .single();

        if (moduleError) throw moduleError;

        const lessons = module.lessons || [];
        const incomingLessonIds = lessons.map((lesson) => lesson.id);

        if (incomingLessonIds.length > 0) {
          const { data: existingLessons } = await supabase
            .from('lessons')
            .select('id')
            .eq('module_id', moduleRow.id);

          const lessonsToDelete = (existingLessons || [])
            .map((row) => row.id)
            .filter((id) => !incomingLessonIds.includes(id));

          if (lessonsToDelete.length > 0) {
            await supabase.from('lessons').delete().in('id', lessonsToDelete);
          }

          for (const [lessonIndex, lesson] of lessons.entries()) {
            const { error: lessonError } = await supabase
              .from('lessons')
              .upsert({
                id: lesson.id,
                module_id: moduleRow.id,
                order_index: lesson.order_index ?? lessonIndex,
                type: lesson.type,
                title: lesson.title,
                description: lesson.description ?? null,
                duration_s: lesson.duration_s ?? null,
                content_json: lesson.content_json ?? {},
                completion_rule_json: lesson.completion_rule_json ?? null
              });

            if (lessonError) throw lessonError;
          }
        } else {
          await supabase.from('lessons').delete().eq('module_id', moduleRow.id);
        }
      }
    } else {
  await supabase.from('modules').delete().eq('course_id', courseRow.id);
    }

    const refreshed = await supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
  .eq('id', courseRow.id)
      .single();

    if (refreshed.error) throw refreshed.error;

    // If an idempotency key was provided, record the resulting resource id
    if (idempotencyKey) {
      try {
        await supabase.from('idempotency_keys').update({ resource_id: refreshed.data?.id }).eq('id', idempotencyKey);
      } catch (updErr) {
        console.warn('Failed to update idempotency_keys with resource id', updErr);
      }
    }

    res.status(201).json({ data: refreshed.data });
  } catch (error) {
    console.error('Failed to upsert course:', error);
    // Provide more details to the client for debugging
    const errorMessage = error?.message || 'Unable to save course';
    const errorDetails = error?.details || error?.hint || null;
    res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      timestamp: new Date().toISOString()
    });
  }
});

// Batch import endpoint (best-effort transactional behavior in E2E/DEV fallback)
app.post('/api/admin/courses/import', async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    res.status(400).json({ error: 'items array is required' });
    return;
  }

  // In demo/E2E, snapshot and rollback on failure
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const snapshot = new Map(e2eStore.courses);
    const results = [];
    try {
      for (const payload of items) {
        const { course, modules = [] } = payload || {};
        if (!course?.title) throw new Error('Course title is required');

        // Reuse the same logic as the single upsert route: upsert by id/slug/external_id
        let existingId = null;
        const incomingSlug = course.slug ?? null;
        const incomingExternalId = (course.external_id ?? course.meta?.external_id ?? null) || null;
        if (!course.id) {
          for (const c of e2eStore.courses.values()) {
            const cSlug = c.slug ?? c.id;
            const cExternal = c.meta_json?.external_id ?? null;
            if (incomingSlug && String(cSlug).toLowerCase() === String(incomingSlug).toLowerCase()) {
              existingId = c.id;
              break;
            }
            if (incomingExternalId && cExternal && String(cExternal) === String(incomingExternalId)) {
              existingId = c.id;
              break;
            }
          }
        }
        const id = course.id ?? existingId ?? `e2e-course-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const courseObj = {
          id,
          slug: course.slug ?? id,
          title: course.title,
          description: course.description ?? null,
          status: course.status ?? 'draft',
          version: course.version ?? 1,
          meta_json: { ...(course.meta ?? {}), ...(incomingExternalId ? { external_id: incomingExternalId } : {}) },
          published_at: null,
          modules: [],
        };
        const modulesArr = modules || [];
        for (const [moduleIndex, module] of modulesArr.entries()) {
          const moduleId = module.id ?? `e2e-mod-${Date.now()}-${moduleIndex}-${Math.floor(Math.random()*1000)}`;
          const moduleObj = {
            id: moduleId,
            course_id: id,
            title: module.title,
            description: module.description ?? null,
            order_index: module.order_index ?? moduleIndex,
            lessons: [],
          };
          const lessons = module.lessons || [];
          for (const [lessonIndex, lesson] of lessons.entries()) {
            const lessonId = lesson.id ?? `e2e-less-${Date.now()}-${moduleIndex}-${lessonIndex}-${Math.floor(Math.random()*1000)}`;
            const lessonObj = {
              id: lessonId,
              module_id: moduleId,
              title: lesson.title,
              description: lesson.description ?? null,
              type: lesson.type,
              order_index: lesson.order_index ?? lesson.order ?? lessonIndex,
              duration_s: lesson.duration_s ?? null,
              content_json: lesson.content_json ?? lesson.content ?? {},
              completion_rule_json: lesson.completion_rule_json ?? lesson.completionRule ?? null,
            };
            moduleObj.lessons.push(lessonObj);
          }
          courseObj.modules.push(moduleObj);
        }
        e2eStore.courses.set(id, courseObj);
        results.push({ id, slug: courseObj.slug, title: courseObj.title });
      }
      persistE2EStore();
      res.status(201).json({ data: results });
    } catch (err) {
      // Rollback
      e2eStore.courses = snapshot;
      persistE2EStore();
      res.status(400).json({ error: 'Import failed', details: String(err?.message || err) });
    }
    return;
  }

  // Supabase-backed path: sequential upsert (no transaction here)
  if (!ensureSupabase(res)) return;
  try {
    const results = [];
    for (const payload of items) {
      const { course, modules = [] } = payload || {};
      if (!course?.title) throw new Error('Course title is required');
      const upsertRes = await supabase
        .from('courses')
        .upsert({
          id: course.id ?? undefined,
          slug: course.slug ?? undefined,
          title: course.title,
          description: course.description ?? null,
          status: course.status ?? 'draft',
          version: course.version ?? 1,
          organization_id: course.organizationId ?? course.org_id ?? null,
          meta_json: { ...(course.meta ?? {}), ...(course.external_id ? { external_id: course.external_id } : {}) },
        })
        .select('*')
        .single();
      if (upsertRes.error) throw upsertRes.error;
      const courseRow = upsertRes.data;
      // naive: clear and reinsert modules/lessons for this course
      await supabase.from('lessons').delete().in('module_id', (
        (await supabase.from('modules').select('id').eq('course_id', courseRow.id)).data || []
      ).map((r) => r.id));
      await supabase.from('modules').delete().eq('course_id', courseRow.id);

      for (const [moduleIndex, module] of (modules || []).entries()) {
        const modIns = await supabase
          .from('modules')
          .insert({
            id: module.id ?? undefined,
            course_id: courseRow.id,
            order_index: module.order_index ?? moduleIndex,
            title: module.title,
            description: module.description ?? null,
          })
          .select('*')
          .single();
        if (modIns.error) throw modIns.error;
        const modRow = modIns.data;
        for (const [lessonIndex, lesson] of (module.lessons || []).entries()) {
          const lesIns = await supabase.from('lessons').insert({
            id: lesson.id ?? undefined,
            module_id: modRow.id,
            order_index: lesson.order_index ?? lessonIndex,
            type: lesson.type,
            title: lesson.title,
            description: lesson.description ?? null,
            duration_s: lesson.duration_s ?? null,
            content_json: lesson.content_json ?? lesson.content ?? {},
            completion_rule_json: lesson.completion_rule_json ?? lesson.completionRule ?? null,
          });
          if (lesIns.error) throw lesIns.error;
        }
      }
      results.push({ id: courseRow.id, slug: courseRow.slug, title: courseRow.title });
    }
    res.status(201).json({ data: results });
  } catch (error) {
    console.error('Import failed:', error);
    res.status(500).json({ error: 'Import failed' });
  }
});

// Assignments listing for client: return active assignments for a user
app.get('/api/client/assignments', async (req, res) => {
  const userId = (req.query.user_id || req.query.userId || '').toString().toLowerCase();
  if (!userId) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const rows = (e2eStore.assignments || []).filter((a) => a && a.active !== false && String(a.user_id || '').toLowerCase() === userId);
    res.json({ data: rows });
    return;
  }

  if (!ensureSupabase(res)) return;
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) {
    console.error('Failed to fetch assignments:', err);
    res.status(500).json({ error: 'Unable to fetch assignments' });
  }
});

app.post('/api/admin/courses/:id/publish', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    // E2E fallback when Supabase isn't configured
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      const existing = e2eStore.courses.get(id);
      if (!existing) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      existing.status = 'published';
      existing.version = req.body?.version ?? existing.version ?? 1;
      existing.published_at = new Date().toISOString();

      // Broadcast publish event to org and global listeners
      try {
        const orgId = existing.organization_id || existing.org_id || null;
        const payload = { type: 'course_updated', data: existing, timestamp: Date.now() };
        if (orgId) broadcastToTopic(`course:updates:${orgId}`, payload);
        broadcastToTopic('course:updates', payload);
      } catch (bErr) {
        console.warn('Failed to broadcast course publish event', bErr);
      }

      res.json({ data: existing });
      return;
    }

    // Normal Supabase-backed path
    // 1) Fetch existing course
    const existing = await supabase
      .from('courses')
      .select('*, organization_id, org_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (!existing.data) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const nextVersion = req.body?.version ?? existing.data.version ?? 1;
    const publishedAt = new Date().toISOString();

    // 2) Update status -> published
    const updated = await supabase
      .from('courses')
      .update({ status: 'published', published_at: publishedAt, version: nextVersion })
      .eq('id', id)
      .select('*, modules(*, lessons(*))')
      .single();

    if (updated.error) throw updated.error;

    // 3) Broadcast publish event to org and global listeners
    try {
      const orgId = updated.data?.organization_id || updated.data?.org_id || null;
      const payload = { type: 'course_updated', data: updated.data, timestamp: Date.now() };
      if (orgId) broadcastToTopic(`course:updates:${orgId}`, payload);
      broadcastToTopic('course:updates', payload);
    } catch (bErr) {
      console.warn('Failed to broadcast course publish event', bErr);
    }

    res.json({ data: updated.data });
  } catch (error) {
    console.error(`Failed to publish course ${id}:`, error);
    res.status(500).json({ error: 'Unable to publish course' });
  }
});

app.post('/api/admin/courses/:id/assign', async (req, res) => {
  console.log('Assign handler called - supabase present?', Boolean(supabase), 'E2E_TEST_MODE=', E2E_TEST_MODE, 'body=', JSON.stringify(req.body));
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const { organization_id, user_ids = [], due_at } = req.body || {};

  if (!organization_id) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }

  try {
    // Build desired payloads (one per target user or org-wide if no user_ids)
    const desired = (user_ids.length > 0 ? user_ids : [null]).map((userId) => ({
      organization_id,
      course_id: id,
      user_id: userId,
      due_at: due_at ?? null,
      active: true
    }));

    // E2E in-memory fallback branch will run before any Supabase queries
    // when Supabase isn't configured but E2E_TEST_MODE is enabled.
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
      const existingAssignments = [];
      const toInsert = [];

      for (const item of desired) {
        const found = e2eStore.assignments.find((a) => {
          if (!a) return false;
          if (String(a.organization_id) !== String(item.organization_id)) return false;
          if (String(a.course_id) !== String(item.course_id)) return false;
          if (!a.active) return false;
          if (a.user_id === null && item.user_id === null) return true;
          if (a.user_id === null || item.user_id === null) return false;
          return String(a.user_id) === String(item.user_id);
        });

        if (found) {
          existingAssignments.push(found);
        } else {
          toInsert.push(item);
        }
      }

      const inserted = [];
      for (const it of toInsert) {
        const newAsn = Object.assign({}, it, {
          id: `e2e-asn-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          created_at: new Date().toISOString()
        });
        e2eStore.assignments.push(newAsn);
        inserted.push(newAsn);
      }

      const assignments = [...existingAssignments, ...inserted];

      try {
        for (const asn of inserted) {
          const orgId = asn.organization_id || asn.org_id || organization_id || null;
          const topicOrg = orgId ? `assignment:org:${orgId}` : 'assignment:org:global';
          const payload = { type: 'assignment_created', data: asn, timestamp: Date.now() };
          broadcastToTopic(topicOrg, payload);
          if (asn.user_id) {
            broadcastToTopic(`assignment:user:${String(asn.user_id).toLowerCase()}`, payload);
          }
        }
      } catch (bErr) {
        console.warn('Failed to broadcast assignment events', bErr);
      }

      res.status(201).json({ data: assignments });
      return;
    }

    const existingAssignments = [];
    const toInsert = [];

    // Check for existing active assignments to avoid duplicates
    for (const item of desired) {
      let query = supabase.from('assignments').select('*').eq('organization_id', item.organization_id).eq('course_id', item.course_id).eq('active', true).limit(1);
      if (item.user_id === null) {
        query = query.is('user_id', null);
      } else {
        query = query.eq('user_id', item.user_id);
      }

      const { data: existing, error: fetchErr } = await query.maybeSingle();
      if (fetchErr) throw fetchErr;

      if (existing) {
        existingAssignments.push(existing);
      } else {
        toInsert.push(item);
      }
    }

    let inserted = [];
    if (toInsert.length > 0) {
      const { data: insData, error: insErr } = await supabase
        .from('assignments')
        .insert(toInsert)
        .select('*');
      if (insErr) throw insErr;
      inserted = insData || [];
    }

    const assignments = [...existingAssignments, ...inserted];

    // Broadcast assignment events for newly created assignments only
    try {
      for (const asn of inserted) {
        const orgId = asn.organization_id || asn.org_id || organization_id || null;
        const topicOrg = orgId ? `assignment:org:${orgId}` : 'assignment:org:global';
        const payload = { type: 'assignment_created', data: asn, timestamp: Date.now() };
        broadcastToTopic(topicOrg, payload);
        if (asn.user_id) {
          broadcastToTopic(`assignment:user:${String(asn.user_id).toLowerCase()}`, payload);
        }
      }
    } catch (bErr) {
      console.warn('Failed to broadcast assignment events', bErr);
    }

    res.status(201).json({ data: assignments });
  } catch (error) {
    console.error('Failed to assign course:', error);
    res.status(500).json({ error: 'Unable to assign course' });
  }
});

app.delete('/api/admin/courses/:id', async (req, res) => {
  const { id } = req.params;

  // Dev/E2E fallback
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    try {
      e2eStore.courses.delete(id);
      persistE2EStore();
      console.log(`✅ Deleted course ${id} from persistent storage`);
      res.status(204).end();
    } catch (error) {
      console.error('E2E: Failed to delete course:', error);
      res.status(500).json({ error: 'Unable to delete course' });
    }
    return;
  }

  if (!ensureSupabase(res)) return;
  try {
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete course:', error);
    res.status(500).json({ error: 'Unable to delete course' });
  }
});

app.get('/api/client/courses', async (_req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    // In dev/demo mode, show ALL courses (not just published)
    const data = Array.from(e2eStore.courses.values())
      .map((c) => ({
        id: c.id,
        slug: c.slug ?? c.id,
        title: c.title,
        description: c.description ?? null,
        status: c.status ?? 'draft',
        version: c.version ?? 1,
        meta_json: c.meta_json ?? {},
        published_at: c.published_at ?? null,
        thumbnail: c.thumbnail ?? null,
        difficulty: c.difficulty ?? null,
        duration: c.duration ?? null,
        instructorName: c.instructorName ?? null,
        estimatedDuration: c.estimatedDuration ?? null,
        keyTakeaways: c.keyTakeaways ?? [],
        modules: (c.modules || []).map((m) => ({
          id: m.id,
          course_id: c.id,
          title: m.title,
          description: m.description ?? null,
          order_index: m.order_index ?? m.order ?? 0,
          lessons: (m.lessons || []).map((l) => ({
            id: l.id,
            module_id: m.id,
            title: l.title,
            description: l.description ?? null,
            type: l.type,
            order_index: l.order_index ?? l.order ?? 0,
            duration_s: l.duration_s ?? null,
            content: l.content_json ?? l.content ?? {},
            content_json: l.content_json ?? l.content ?? {},
            completion_rule_json: l.completion_rule_json ?? l.completionRule ?? null,
          })),
        })),
      }));
    res.json({ data });
    return;
  }

  if (!ensureSupabase(res)) return;
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: 'modules.lessons' });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch published courses:', error);
    res.status(500).json({ error: 'Unable to fetch courses' });
  }
});

app.get('/api/client/courses/:identifier', async (req, res) => {
  const { identifier } = req.params;
  const includeDrafts = String(req.query.includeDrafts || '').toLowerCase() === 'true';

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    try {
      const course = e2eFindCourse(identifier);
      if (!course) {
        res.json({ data: null });
        return;
      }
      // In dev/demo mode, show all courses regardless of status
      // (ignore the includeDrafts query param)

      const data = {
        id: course.id,
        slug: course.slug ?? course.id,
        title: course.title,
        description: course.description ?? null,
        status: course.status ?? 'draft',
        version: course.version ?? 1,
        meta_json: course.meta_json ?? {},
        published_at: course.published_at ?? null,
        thumbnail: course.thumbnail ?? null,
        difficulty: course.difficulty ?? null,
        duration: course.duration ?? null,
        instructorName: course.instructorName ?? null,
        estimatedDuration: course.estimatedDuration ?? null,
        keyTakeaways: course.keyTakeaways ?? [],
        modules: (course.modules || []).map((m) => ({
          id: m.id,
          course_id: course.id,
          title: m.title,
          description: m.description ?? null,
          order_index: m.order_index ?? m.order ?? 0,
          lessons: (m.lessons || []).map((l) => ({
            id: l.id,
            module_id: m.id,
            title: l.title,
            description: l.description ?? null,
            type: l.type,
            order_index: l.order_index ?? l.order ?? 0,
            duration_s: l.duration_s ?? null,
            content: l.content_json ?? l.content ?? {},
            content_json: l.content_json ?? l.content ?? {},
            completion_rule_json: l.completion_rule_json ?? l.completionRule ?? null,
          })),
        })),
      };
      res.json({ data });
      return;
    } catch (error) {
      console.error(`E2E fetch course ${identifier} failed:`, error);
      res.status(500).json({ error: 'Unable to load course' });
      return;
    }
  }

  if (!ensureSupabase(res)) return;
  const buildQuery = (column, value) => {
    let query = supabase
      .from('courses')
      .select('*, modules(*, lessons(*))')
      .eq(column, value)
      .order('order_index', { ascending: true, foreignTable: 'modules' })
      .order('order_index', { ascending: true, foreignTable: 'modules.lessons' })
      .maybeSingle();
    if (!includeDrafts) query = query.eq('status', 'published');
    return query;
  };
  try {
    let { data, error } = await buildQuery('id', identifier);
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) {
      ({ data, error } = await buildQuery('slug', identifier));
      if (error && error.code !== 'PGRST116') throw error;
    }
    res.json({ data: data ?? null });
  } catch (error) {
    console.error(`Failed to fetch course ${identifier}:`, error);
    res.status(500).json({ error: 'Unable to load course' });
  }
});

// Admin Modules (E2E fallback)
app.post('/api/admin/modules', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const parsed = validateOr400(moduleCreateSchema, req, res);
    if (!parsed) return;
    const courseId = pickId(parsed, 'course_id', 'courseId');
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const metadata = parsed.metadata ?? {};
    if (!courseId || !title) {
      res.status(400).json({ error: 'courseId and title are required' });
      return;
    }
    const course = e2eFindCourse(courseId);
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    // Optional optimistic check: ensure client is targeting expected course version
    if (typeof expectedCourseVersion === 'number') {
      const current = course.version ?? 1;
      if (expectedCourseVersion < current) {
        res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
        return;
      }
    }
    const id = `e2e-mod-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const mod = { id, course_id: course.id, title, description, order_index: orderIndex, lessons: [], metadata: metadata ?? {} };
    course.modules = course.modules || [];
    course.modules.push(mod);
    persistE2EStore();
    console.log(`✅ Created module "${title}" in course "${course.title}"`);
    res.status(201).json({ data: { id, course_id: course.id, title, description, order_index: orderIndex } });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const parsed = validateOr400(moduleCreateSchema, req, res);
    if (!parsed) return;
    const courseId = pickId(parsed, 'course_id', 'courseId');
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    if (!courseId || !title) {
      res.status(400).json({ error: 'courseId and title are required' });
      return;
    }
    // Optional optimistic check against parent course version to avoid stale edits
    if (typeof expectedCourseVersion === 'number') {
      const { data: courseRow, error: fetchErr } = await supabase.from('courses').select('id,version').eq('id', courseId).maybeSingle();
      if (fetchErr) throw fetchErr;
      const current = courseRow?.version ?? null;
      if (current !== null && expectedCourseVersion < current) {
        res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
        return;
      }
    }
    const { data, error } = await supabase
      .from('modules')
      .insert({ course_id: courseId, title, description, order_index: orderIndex })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ data: { id: data.id, course_id: data.course_id, title: data.title, description: data.description, order_index: data.order_index ?? 0 } });
  } catch (error) {
    console.error('Failed to create module:', error);
    res.status(500).json({ error: 'Unable to create module' });
  }
});

app.patch('/api/admin/modules/:id', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { id } = req.params;
    const parsed = validateOr400(modulePatchValidator, req, res);
    if (!parsed) return;
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const found = e2eFindModule(id);
    if (!found) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }
    if (typeof title === 'string') found.module.title = title;
    if (description !== undefined) found.module.description = description;
    if (typeof orderIndex === 'number') found.module.order_index = orderIndex;
    persistE2EStore();
    console.log(`✅ Updated module ${id}`);
    res.json({ data: { id: found.module.id, course_id: found.course.id, title: found.module.title, description: found.module.description, order_index: found.module.order_index ?? 0 } });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const { id } = req.params;
    const parsed = validateOr400(modulePatchValidator, req, res);
    if (!parsed) return;
    const title = parsed.title;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const patch = {};
    if (typeof title === 'string') patch.title = title;
    if (description !== undefined) patch.description = description;
    if (typeof orderIndex === 'number') patch.order_index = orderIndex;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    // If client provided expected course version, validate against course to avoid stale updates
    if (typeof expectedCourseVersion === 'number') {
      // Fetch parent course id for this module
      const { data: modRow, error: modErr } = await supabase.from('modules').select('id,course_id').eq('id', id).maybeSingle();
      if (modErr) throw modErr;
      const courseId = modRow?.course_id ?? null;
      if (courseId) {
        const { data: courseRow, error: fetchErr } = await supabase.from('courses').select('id,version').eq('id', courseId).maybeSingle();
        if (fetchErr) throw fetchErr;
        const current = courseRow?.version ?? null;
        if (current !== null && expectedCourseVersion < current) {
          res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
          return;
        }
      }
    }
    const { data, error } = await supabase
      .from('modules')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ data: { id: data.id, course_id: data.course_id, title: data.title, description: data.description, order_index: data.order_index ?? 0 } });
  } catch (error) {
    console.error('Failed to update module:', error);
    res.status(500).json({ error: 'Unable to update module' });
  }
});

app.delete('/api/admin/modules/:id', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { id } = req.params;
    const found = e2eFindModule(id);
    if (!found) {
      res.status(204).end();
      return;
    }
    found.course.modules = (found.course.modules || []).filter((m) => String(m.id) !== String(id));
    persistE2EStore();
    console.log(`✅ Deleted module ${id}`);
    res.status(204).end();
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const { id } = req.params;
    // Delete lessons first (in case FK cascade not set)
    await supabase.from('lessons').delete().eq('module_id', id);
    await supabase.from('modules').delete().eq('id', id);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete module:', error);
    res.status(500).json({ error: 'Unable to delete module' });
  }
});

app.post('/api/admin/modules/reorder', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const parsed = validateOr400(moduleReorderSchema, req, res);
    if (!parsed) return;
    const courseId = pickId(parsed, 'course_id', 'courseId');
    const modules = parsed.modules;
    const course = e2eFindCourse(courseId);
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    const orderMap = new Map((modules || []).map((m) => [String(m.id), pickOrder(m)]));
    (course.modules || []).forEach((m) => {
      const idx = orderMap.get(String(m.id));
      if (typeof idx === 'number') m.order_index = idx;
    });
    const sorted = (course.modules || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    course.modules = sorted;
    persistE2EStore();
    console.log(`✅ Reordered modules in course "${course.title}"`);
    const response = sorted.map((m) => ({ id: m.id, order_index: m.order_index ?? 0 }));
    res.json({ data: response });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const parsed = validateOr400(moduleReorderSchema, req, res);
    if (!parsed) return;
    const courseId = pickId(parsed, 'course_id', 'courseId');
    const modules = parsed.modules;
    if (!courseId || !Array.isArray(modules)) {
      res.status(400).json({ error: 'courseId and modules are required' });
      return;
    }
    const updates = (modules || []).map((m) => {
      return supabase.from('modules').update({ order_index: pickOrder(m) }).eq('id', m.id);
    });
    await Promise.all(updates);
    const order = modules.map((m) => ({ id: m.id, order_index: pickOrder(m) }));
    res.json({ data: order });
  } catch (error) {
    console.error('Failed to reorder modules:', error);
    res.status(500).json({ error: 'Unable to reorder modules' });
  }
});

// Admin Lessons (E2E fallback)
app.post('/api/admin/lessons', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const parsed = validateOr400(lessonCreateSchema, req, res);
    if (!parsed) return;
    const moduleId = pickId(parsed, 'module_id', 'moduleId');
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const type = parsed.type;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;
    const content = parsed.content ?? {};
    const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;
    if (!moduleId || !title || !type) {
      res.status(400).json({ error: 'moduleId, title and type are required' });
      return;
    }
    const found = e2eFindModule(moduleId);
    if (!found) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }
    // Optional optimistic check: ensure client targets expected course version
    if (typeof expectedCourseVersion === 'number') {
      const course = found.course;
      const current = course.version ?? 1;
      if (expectedCourseVersion < current) {
        res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
        return;
      }
    }
    const id = `e2e-less-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const lesson = {
      id,
      module_id: moduleId,
      title,
      description,
      type,
      order_index: orderIndex,
      duration_s: durationSeconds,
      content_json: (content && typeof content === 'object') ? (content.body ?? content) : {},
      completion_rule_json: completionRule ?? null,
    };
    found.module.lessons = found.module.lessons || [];
    found.module.lessons.push(lesson);
    persistE2EStore();
    console.log(`✅ Created lesson "${title}" in module "${found.module.title}"`);
    res.status(201).json({ data: { id, module_id: moduleId, title, type, order_index: orderIndex } });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const parsed = validateOr400(lessonCreateSchema, req, res);
    if (!parsed) return;
    const moduleId = pickId(parsed, 'module_id', 'moduleId');
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const type = parsed.type;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;
    const content = parsed.content ?? {};
    const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;
    if (!moduleId || !title || !type) {
      res.status(400).json({ error: 'moduleId, title and type are required' });
      return;
    }
    // Optional optimistic check: if client provided expected course version, compare
    if (typeof expectedCourseVersion === 'number') {
      // fetch module to get parent course id
      const { data: modRow, error: modErr } = await supabase.from('modules').select('id,course_id').eq('id', moduleId).maybeSingle();
      if (modErr) throw modErr;
      const courseId = modRow?.course_id ?? null;
      if (courseId) {
        const { data: courseRow, error: fetchErr } = await supabase.from('courses').select('id,version').eq('id', courseId).maybeSingle();
        if (fetchErr) throw fetchErr;
        const current = courseRow?.version ?? null;
        if (current !== null && expectedCourseVersion < current) {
          res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
          return;
        }
      }
    }
    const payload = {
      module_id: moduleId,
      title,
      type,
      description,
      order_index: orderIndex,
      duration_s: durationSeconds,
      content_json: content && typeof content === 'object' ? content.body ?? content : {},
      completion_rule_json: completionRule ?? null,
    };
    const { data, error } = await supabase
      .from('lessons')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ data: { id: data.id, module_id: data.module_id, title: data.title, type: data.type, order_index: data.order_index ?? 0 } });
  } catch (error) {
    console.error('Failed to create lesson:', error);
    res.status(500).json({ error: 'Unable to create lesson' });
  }
});

app.patch('/api/admin/lessons/:id', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { id } = req.params;
    const parsed = validateOr400(lessonPatchValidator, req, res);
    if (!parsed) return;
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const title = parsed.title;
    const type = parsed.type;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;
    const content = parsed.content ?? {};
    const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;
    const found = e2eFindLesson(id);
    if (!found) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }
    if (typeof title === 'string') found.lesson.title = title;
    if (typeof type === 'string') found.lesson.type = type;
    if (description !== undefined) found.lesson.description = description;
    if (typeof orderIndex === 'number') found.lesson.order_index = orderIndex;
    if (typeof durationSeconds === 'number') found.lesson.duration_s = durationSeconds;
    if (content !== undefined) found.lesson.content_json = (content && typeof content === 'object') ? (content.body ?? content) : {};
    if (completionRule !== undefined) found.lesson.completion_rule_json = completionRule;
    persistE2EStore();
    console.log(`✅ Updated lesson ${id}`);
    res.json({ data: { id: found.lesson.id, module_id: found.module.id, title: found.lesson.title, type: found.lesson.type, order_index: found.lesson.order_index ?? 0 } });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const { id } = req.params;
    const parsed = validateOr400(lessonPatchValidator, req, res);
    if (!parsed) return;
    const title = parsed.title;
    const type = parsed.type;
    const description = parsed.description ?? null;
    const orderIndex = pickOrder(parsed);
    const durationSeconds = parsed.duration_s ?? parsed.durationSeconds ?? null;
    const content = parsed.content ?? {};
    const completionRule = parsed.completion_rule_json ?? parsed.completionRule ?? null;
    const expectedCourseVersion = parsed.course_version ?? parsed.expectedCourseVersion ?? null;
    const patch = {};
    if (typeof title === 'string') patch.title = title;
    if (typeof type === 'string') patch.type = type;
    if (description !== undefined) patch.description = description;
    if (typeof orderIndex === 'number') patch.order_index = orderIndex;
    if (typeof durationSeconds === 'number') patch.duration_s = durationSeconds;
    if (content !== undefined) patch.content_json = content && typeof content === 'object' ? content.body ?? content : {};
    if (completionRule !== undefined) patch.completion_rule_json = completionRule;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    // If client provided expected course version, validate against parent course to avoid stale edits
    if (typeof expectedCourseVersion === 'number') {
      // resolve parent course via module
      const { data: lessonRow, error: lErr } = await supabase.from('lessons').select('id,module_id').eq('id', id).maybeSingle();
      if (lErr) throw lErr;
      const moduleId = lessonRow?.module_id ?? null;
      if (moduleId) {
        const { data: modRow, error: mErr } = await supabase.from('modules').select('id,course_id').eq('id', moduleId).maybeSingle();
        if (mErr) throw mErr;
        const courseId = modRow?.course_id ?? null;
        if (courseId) {
          const { data: courseRow, error: cErr } = await supabase.from('courses').select('id,version').eq('id', courseId).maybeSingle();
          if (cErr) throw cErr;
          const current = courseRow?.version ?? null;
          if (current !== null && expectedCourseVersion < current) {
            res.status(409).json({ error: 'version_conflict', message: `Course has newer version ${current}` });
            return;
          }
        }
      }
    }
    const { data, error } = await supabase
      .from('lessons')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ data: { id: data.id, module_id: data.module_id, title: data.title, type: data.type, order_index: data.order_index ?? 0 } });
  } catch (error) {
    console.error('Failed to update lesson:', error);
    res.status(500).json({ error: 'Unable to update lesson' });
  }
});

app.delete('/api/admin/lessons/:id', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { id } = req.params;
    for (const course of e2eStore.courses.values()) {
      for (const mod of course.modules || []) {
        const before = (mod.lessons || []).length;
        mod.lessons = (mod.lessons || []).filter((l) => String(l.id) !== String(id));
        if (mod.lessons.length !== before) {
          persistE2EStore();
          console.log(`✅ Deleted lesson ${id}`);
          res.status(204).end();
          return;
        }
      }
    }
    res.status(204).end();
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const { id } = req.params;
    await supabase.from('lessons').delete().eq('id', id);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete lesson:', error);
    res.status(500).json({ error: 'Unable to delete lesson' });
  }
});

app.post('/api/admin/lessons/reorder', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const parsed = validateOr400(lessonReorderSchema, req, res);
    if (!parsed) return;
    const moduleId = pickId(parsed, 'module_id', 'moduleId');
    const lessons = parsed.lessons;
    const found = e2eFindModule(moduleId);
    if (!found) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }
    const orderMap = new Map((lessons || []).map((l) => [String(l.id), pickOrder(l)]));
    (found.module.lessons || []).forEach((l) => {
      const idx = orderMap.get(String(l.id));
      if (typeof idx === 'number') l.order_index = idx;
    });
    found.module.lessons = (found.module.lessons || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    persistE2EStore();
    console.log(`✅ Reordered lessons in module "${found.module.title}"`);
    const response = (found.module.lessons || []).map((l) => ({ id: l.id, order_index: l.order_index ?? 0 }));
    res.json({ data: response });
    return;
  }
  if (!ensureSupabase(res)) return;
  try {
    const parsed = validateOr400(lessonReorderSchema, req, res);
    if (!parsed) return;
    const moduleId = pickId(parsed, 'module_id', 'moduleId');
    const lessons = parsed.lessons;
    if (!moduleId || !Array.isArray(lessons)) {
      res.status(400).json({ error: 'moduleId and lessons are required' });
      return;
    }
    const updates = (lessons || []).map((l) => {
      return supabase.from('lessons').update({ order_index: pickOrder(l) }).eq('id', l.id);
    });
    await Promise.all(updates);
    const order = lessons.map((l) => ({ id: l.id, order_index: pickOrder(l) }));
    res.json({ data: order });
  } catch (error) {
    console.error('Failed to reorder lessons:', error);
    res.status(500).json({ error: 'Unable to reorder lessons' });
  }
});

// Learner progress endpoint (used by progressService.ts)
app.post('/api/learner/progress', async (req, res) => {
  const body = req.body || {};
  
  // Accept multiple possible field name formats
  const userId = body.userId || body.user_id || body.learnerId || body.learner_id;
  const courseId = body.courseId || body.course_id;
  const lessons = body.lessons || body.lessonProgress || [];
  const course = body.course || body.courseProgress || {};
  
  // Log for debugging
  if (DEV_FALLBACK || E2E_TEST_MODE) {
    console.log('Progress sync request:', {
      userId,
      courseId,
      lessonCount: lessons.length,
      overallPercent: course.percent || course.percentComplete || 0
    });
  }

  // In E2E/DEMO mode, just acknowledge the progress sync
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    res.json({ 
      success: true, 
      message: 'Progress synced (demo mode)',
      data: {
        userId: userId || 'unknown',
        courseId: courseId || 'unknown',
        lessonCount: lessons.length,
        overallPercent: course.percent || course.percentComplete || 0
      }
    });
    return;
  }

  // If Supabase is configured, you can implement actual storage here
  if (!ensureSupabase(res)) return;
  
  try {
    // For now, just acknowledge in Supabase mode too
    // TODO: Implement actual progress storage in Supabase
    res.json({ 
      success: true, 
      message: 'Progress synced',
      data: {
        userId: userId || 'unknown',
        courseId: courseId || 'unknown',
        lessonCount: lessons.length,
        overallPercent: course.percent || course.percentComplete || 0
      }
    });
  } catch (error) {
    console.error('Failed to sync learner progress:', error);
    res.status(500).json({ error: 'Unable to sync progress' });
  }
});

// GET learner progress endpoint (fetching progress)
app.get('/api/learner/progress', async (req, res) => {
  const { userId, courseId, lessonIds } = req.query;
  
  // In demo/E2E mode, return empty progress
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    res.json({ 
      success: true,
      data: {
        userId: userId || 'unknown',
        courseId: courseId || 'unknown',
        lessons: [],
        message: 'No saved progress in demo mode'
      }
    });
    return;
  }

  if (!ensureSupabase(res)) return;
  
  try {
    // TODO: Implement actual progress fetching from Supabase
    res.json({ 
      success: true,
      data: {
        userId,
        courseId,
        lessons: []
      }
    });
  } catch (error) {
    console.error('Failed to fetch learner progress:', error);
    res.status(500).json({ error: 'Unable to fetch progress' });
  }
});

app.post('/api/client/progress/course', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { user_id, course_id, percent, status, time_spent_s } = req.body || {};
    const clientEventId = req.body?.client_event_id ?? null;

    if (!user_id || !course_id) {
      res.status(400).json({ error: 'user_id and course_id are required' });
      return;
    }

    // Rate limit per user to avoid abuse
    const rlKey = `course:${String(user_id).toLowerCase()}`;
    if (!checkProgressLimit(rlKey)) {
      res.status(429).json({ error: 'Too many progress updates, please slow down' });
      return;
    }

    try {
      if (clientEventId) {
        if (e2eStore.progressEvents.has(clientEventId)) {
          const key = `${user_id}:${course_id}`;
          const existing = e2eStore.courseProgress.get(key) || null;
          res.json({ data: existing, idempotent: true });
          return;
        }
        e2eStore.progressEvents.add(clientEventId);
      }

      const key = `${user_id}:${course_id}`;
      const now = new Date().toISOString();
      const record = {
        user_id,
        course_id,
        percent: typeof percent === 'number' ? percent : 0,
        status: status || 'in_progress',
        time_spent_s: typeof time_spent_s === 'number' ? time_spent_s : 0,
        updated_at: now,
      };
      e2eStore.courseProgress.set(key, record);

      try {
        const payload = { type: 'course_progress', data: record, timestamp: Date.now() };
        broadcastToTopic(`progress:user:${String(user_id).toLowerCase()}`, payload);
        broadcastToTopic(`progress:course:${course_id}`, payload);
        broadcastToTopic('progress:all', payload);
      } catch (bErr) {
        console.warn('E2E: Failed to broadcast course progress', bErr);
      }

      res.json({ data: record });
    } catch (error) {
      console.error('E2E: Failed to upsert course progress:', error);
      res.status(500).json({ error: 'Unable to save course progress' });
    }
    return;
  }

  if (!ensureSupabase(res)) return;
  const { user_id, course_id, percent, status, time_spent_s } = req.body || {};
  const clientEventId = req.body?.client_event_id ?? null;

  if (!user_id || !course_id) {
    res.status(400).json({ error: 'user_id and course_id are required' });
    return;
  }

  const rlKey = `course:${String(user_id).toLowerCase()}`;
  if (!checkProgressLimit(rlKey)) {
    res.status(429).json({ error: 'Too many progress updates, please slow down' });
    return;
  }

  try {
    // If client provided an idempotency key, record the event first to avoid double-processing
    if (clientEventId) {
      try {
        await supabase.from('progress_events').insert({ id: clientEventId, user_id, course_id, lesson_id: null, payload: req.body });
      } catch (evErr) {
        // If the event already exists, treat as idempotent and return current progress
        try {
          const existing = await supabase
            .from('user_course_progress')
            .select('*')
            .eq('user_id', user_id)
            .eq('course_id', course_id)
            .maybeSingle();
          if (existing && !existing.error && existing.data) {
            res.json({ data: existing.data, idempotent: true });
            return;
          }
        } catch (fetchErr) {
          // fall through to normal processing
        }
      }
    }
    const { data, error } = await supabase
      .from('user_course_progress')
      .upsert({
        user_id,
        course_id,
        percent: percent ?? 0,
        status: status ?? 'in_progress',
        time_spent_s: time_spent_s ?? 0
      }, { onConflict: 'user_id,course_id' })
      .select('*')
      .single();

    if (error) throw error;
    try {
      const userId = data?.user_id || user_id;
      const courseId = data?.course_id || course_id;
      const payload = { type: 'course_progress', data, timestamp: Date.now() };
      if (userId) broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
      if (courseId) broadcastToTopic(`progress:course:${courseId}`, payload);
      broadcastToTopic('progress:all', payload);
    } catch (bErr) {
      console.warn('Failed to broadcast course progress', bErr);
    }

    res.json({ data });
  } catch (error) {
    console.error('Failed to upsert course progress:', error);
    res.status(500).json({ error: 'Unable to save course progress' });
  }
});

app.post('/api/client/progress/lesson', async (req, res) => {
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const { user_id, lesson_id, percent, status, time_spent_s, resume_at_s } = req.body || {};
    const clientEventId = req.body?.client_event_id ?? null;

    if (!user_id || !lesson_id) {
      res.status(400).json({ error: 'user_id and lesson_id are required' });
      return;
    }

    const rlKey = `lesson:${String(user_id).toLowerCase()}`;
    if (!checkProgressLimit(rlKey)) {
      res.status(429).json({ error: 'Too many progress updates, please slow down' });
      return;
    }

    try {
      if (clientEventId) {
        if (e2eStore.progressEvents.has(clientEventId)) {
          const key = `${user_id}:${lesson_id}`;
          const existing = e2eStore.lessonProgress.get(key) || null;
          res.json({ data: existing, idempotent: true });
          return;
        }
        e2eStore.progressEvents.add(clientEventId);
      }

      const key = `${user_id}:${lesson_id}`;
      const now = new Date().toISOString();
      const record = {
        user_id,
        lesson_id,
        percent: typeof percent === 'number' ? percent : 0,
        status: status || 'in_progress',
        time_spent_s: typeof time_spent_s === 'number' ? time_spent_s : 0,
        resume_at_s: typeof resume_at_s === 'number' ? resume_at_s : null,
        updated_at: now,
      };
      e2eStore.lessonProgress.set(key, record);

      try {
        const payload = { type: 'lesson_progress', data: record, timestamp: Date.now() };
        broadcastToTopic(`progress:user:${String(user_id).toLowerCase()}`, payload);
        broadcastToTopic(`progress:lesson:${lesson_id}`, payload);
        broadcastToTopic('progress:all', payload);
      } catch (bErr) {
        console.warn('E2E: Failed to broadcast lesson progress', bErr);
      }

      res.json({ data: record });
    } catch (error) {
      console.error('E2E: Failed to upsert lesson progress:', error);
      res.status(500).json({ error: 'Unable to save lesson progress' });
    }
    return;
  }

  if (!ensureSupabase(res)) return;
  const { user_id, lesson_id, percent, status, time_spent_s, resume_at_s } = req.body || {};
  const clientEventId = req.body?.client_event_id ?? null;

  if (!user_id || !lesson_id) {
    res.status(400).json({ error: 'user_id and lesson_id are required' });
    return;
  }

  const rlKey = `lesson:${String(user_id).toLowerCase()}`;
  if (!checkProgressLimit(rlKey)) {
    res.status(429).json({ error: 'Too many progress updates, please slow down' });
    return;
  }

  try {
    if (clientEventId) {
      try {
        await supabase.from('progress_events').insert({ id: clientEventId, user_id, course_id: null, lesson_id, payload: req.body });
      } catch (evErr) {
        try {
          const existing = await supabase
            .from('user_lesson_progress')
            .select('*')
            .eq('user_id', user_id)
            .eq('lesson_id', lesson_id)
            .maybeSingle();
          if (existing && !existing.error && existing.data) {
            res.json({ data: existing.data, idempotent: true });
            return;
          }
        } catch (fetchErr) {}
      }
    }
    const { data, error } = await supabase
      .from('user_lesson_progress')
      .upsert({
        user_id,
        lesson_id,
        percent: percent ?? 0,
        status: status ?? 'in_progress',
        time_spent_s: time_spent_s ?? 0,
        resume_at_s: resume_at_s ?? null
      }, { onConflict: 'user_id,lesson_id' })
      .select('*')
      .single();

    if (error) throw error;
    try {
      const userId = data?.user_id || user_id;
      const lessonId = data?.lesson_id || lesson_id;
      const payload = { type: 'lesson_progress', data, timestamp: Date.now() };
      if (userId) broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
      if (lessonId) broadcastToTopic(`progress:lesson:${lessonId}`, payload);
      broadcastToTopic('progress:all', payload);
    } catch (bErr) {
      console.warn('Failed to broadcast lesson progress', bErr);
    }

    res.json({ data });
  } catch (error) {
    console.error('Failed to upsert lesson progress:', error);
    res.status(500).json({ error: 'Unable to save lesson progress' });
  }
});

// ---------------------------------------------------------------------------
// Batch Progress Endpoint (demo/E2E + Supabase placeholder)
// ---------------------------------------------------------------------------
app.post('/api/client/progress/batch', async (req, res) => {
  const payload = req.body || {};
  const events = Array.isArray(payload.events) ? payload.events : [];
  if (events.length === 0) {
    res.status(400).json({ error: 'events array is required' });
    return;
  }
  if (events.length > 25) {
    res.status(400).json({ error: 'too_many_events', message: 'Max 25 events per batch' });
    return;
  }

  // Demo/E2E mode: apply in-memory updates
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const accepted = [];
    const duplicates = [];
    const failed = [];
    for (const evt of events) {
      try {
        const id = evt.clientEventId || evt.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const userId = evt.userId || evt.user_id;
        const lessonId = evt.lessonId || evt.lesson_id || null;
        const courseId = evt.courseId || evt.course_id || null;
        const percentRaw = evt.percent;
        const percent = typeof percentRaw === 'number' ? Math.min(100, Math.max(0, Math.round(percentRaw))) : 0;

        if (!userId) {
          failed.push({ id, reason: 'missing_user' });
          continue;
        }
        if (!courseId && !lessonId) {
          failed.push({ id, reason: 'missing_target' });
          continue;
        }
        if (e2eStore.progressEvents.has(id)) {
          duplicates.push(id);
          continue;
        }
        e2eStore.progressEvents.add(id);

        const nowIso = new Date().toISOString();
        if (lessonId) {
          const key = `${userId}:${lessonId}`;
          const record = {
            user_id: userId,
            lesson_id: lessonId,
            percent,
            status: evt.status || 'in_progress',
            time_spent_s: typeof evt.time_spent_s === 'number' ? evt.time_spent_s : 0,
            resume_at_s: typeof evt.position === 'number' ? evt.position : (typeof evt.resume_at_s === 'number' ? evt.resume_at_s : null),
            updated_at: nowIso,
          };
          e2eStore.lessonProgress.set(key, record);
          try {
            const payload = { type: 'lesson_progress', data: record, timestamp: Date.now() };
            broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
            broadcastToTopic(`progress:lesson:${lessonId}`, payload);
            broadcastToTopic('progress:all', payload);
          } catch {}
        } else if (courseId) {
          const key = `${userId}:${courseId}`;
          const record = {
            user_id: userId,
            course_id: courseId,
            percent,
            status: evt.status || 'in_progress',
            time_spent_s: typeof evt.time_spent_s === 'number' ? evt.time_spent_s : 0,
            updated_at: nowIso,
          };
            e2eStore.courseProgress.set(key, record);
          try {
            const payload = { type: 'course_progress', data: record, timestamp: Date.now() };
            broadcastToTopic(`progress:user:${String(userId).toLowerCase()}`, payload);
            broadcastToTopic(`progress:course:${courseId}`, payload);
            broadcastToTopic('progress:all', payload);
          } catch {}
        }
        accepted.push(id);
      } catch (err) {
        failed.push({ id: evt.clientEventId || evt.client_event_id || 'unknown', reason: 'exception' });
      }
    }
    res.json({ accepted, duplicates, failed });
    return;
  }

  // Supabase path placeholder: treat as accepted and respond (Phase 3 will persist)
  if (!ensureSupabase(res)) return;
  try {
    const accepted = [];
    const duplicates = [];
    const failed = [];
    for (const evt of events) {
      const id = evt.clientEventId || evt.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const userId = evt.userId || evt.user_id;
      const courseId = evt.courseId || evt.course_id || null;
      const lessonId = evt.lessonId || evt.lesson_id || null;
      if (!userId || (!courseId && !lessonId)) {
        failed.push({ id, reason: 'validation' });
        continue;
      }
      // Idempotency check via progress_events table (best-effort)
      try {
        await supabase.from('progress_events').insert({ id, user_id: userId, course_id: courseId, lesson_id: lessonId, payload: evt });
      } catch (evErr) {
        duplicates.push(id);
        continue;
      }
      accepted.push(id);
    }
    res.json({ accepted, duplicates, failed });
  } catch (error) {
    console.error('Failed to process progress batch:', error);
    res.status(500).json({ error: 'Unable to process batch' });
  }
});

// ---------------------------------------------------------------------------
// Batch Analytics Events Endpoint (demo/E2E only for now)
// ---------------------------------------------------------------------------
app.post('/api/analytics/events/batch', async (req, res) => {
  const payload = req.body || {};
  const events = Array.isArray(payload.events) ? payload.events : [];
  if (events.length === 0) {
    res.status(400).json({ error: 'events array is required' });
    return;
  }
  if (events.length > 50) {
    res.status(400).json({ error: 'too_many_events', message: 'Max 50 events per batch' });
    return;
  }

  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    const accepted = [];
    const duplicates = [];
    const failed = [];
    for (const evt of events) {
      const id = evt.clientEventId || evt.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (e2eStore.progressEvents.has(id)) { // reuse idempotency set
        duplicates.push(id);
        continue;
      }
      try {
        e2eStore.progressEvents.add(id);
        e2eStore.analyticsEvents.push({ ...evt, clientEventId: id, timestamp: evt.timestamp || Date.now() });
        accepted.push(id);
      } catch (err) {
        failed.push({ id, reason: 'exception' });
      }
    }
    res.json({ accepted, duplicates, failed });
    return;
  }

  // Supabase placeholder: just accept (Phase 3 persistence)
  if (!ensureSupabase(res)) return;
  try {
    const accepted = events.map((e) => e.clientEventId || e.client_event_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    res.json({ accepted, duplicates: [], failed: [] });
  } catch (error) {
    console.error('Failed to process analytics batch:', error);
    res.status(500).json({ error: 'Unable to process analytics batch' });
  }
});

app.post('/api/client/certificates/:courseId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { courseId } = req.params;
  const { id, user_id, pdf_url, metadata = {} } = req.body || {};

  if (!user_id) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('certificates')
      .insert({
        id: id ?? undefined,
        user_id,
        course_id: courseId,
        pdf_url: pdf_url ?? null,
        metadata
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create certificate:', error);
    res.status(500).json({ error: 'Unable to create certificate' });
  }
});

app.get('/api/client/certificates', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { user_id, course_id } = req.query;

  try {
    let query = supabase
      .from('certificates')
      .select('*')
      .order('created_at', { ascending: false });

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch certificates:', error);
    res.status(500).json({ error: 'Unable to fetch certificates' });
  }
});

// Organization management
app.get('/api/admin/organizations', async (_req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    res.status(500).json({ error: 'Unable to fetch organizations' });
  }
});

app.post('/api/admin/organizations', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};

  if (!payload.name || !payload.contact_email || !payload.subscription) {
    res.status(400).json({ error: 'name, contact_email, and subscription are required' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        id: payload.id ?? undefined,
        name: payload.name,
        type: payload.type ?? null,
        description: payload.description ?? null,
        logo: payload.logo ?? null,
        contact_person: payload.contactPerson ?? null,
        contact_email: payload.contactEmail ?? payload.contact_email,
        contact_phone: payload.contactPhone ?? null,
        website: payload.website ?? null,
        address: payload.address ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        country: payload.country ?? null,
        postal_code: payload.postalCode ?? null,
        subscription: payload.subscription,
        billing_email: payload.billingEmail ?? null,
        billing_cycle: payload.billingCycle ?? null,
        custom_pricing: payload.customPricing ?? null,
        max_learners: payload.maxLearners ?? null,
        max_courses: payload.maxCourses ?? null,
        max_storage: payload.maxStorage ?? null,
        features: payload.features ?? {},
        settings: payload.settings ?? {},
        status: payload.status ?? 'active',
        enrollment_date: payload.enrollmentDate ?? null,
        contract_start: payload.contractStart ?? null,
        contract_end: payload.contractEnd ?? null,
        total_learners: payload.totalLearners ?? 0,
        active_learners: payload.activeLearners ?? 0,
        completion_rate: payload.completionRate ?? 0,
        cohorts: payload.cohorts ?? [],
        last_activity: payload.lastActivity ?? null,
        modules: payload.modules ?? {},
        notes: payload.notes ?? null,
        tags: payload.tags ?? []
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create organization:', error);
    res.status(500).json({ error: 'Unable to create organization' });
  }
});

app.put('/api/admin/organizations/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const patch = req.body || {};

  try {
    const { data, error } = await supabase
      .from('organizations')
      .update({
        name: patch.name,
        type: patch.type,
        description: patch.description,
        logo: patch.logo,
        contact_person: patch.contactPerson,
        contact_email: patch.contactEmail,
        contact_phone: patch.contactPhone,
        website: patch.website,
        address: patch.address,
        city: patch.city,
        state: patch.state,
        country: patch.country,
        postal_code: patch.postalCode,
        subscription: patch.subscription,
        billing_email: patch.billingEmail,
        billing_cycle: patch.billingCycle,
        custom_pricing: patch.customPricing,
        max_learners: patch.maxLearners,
        max_courses: patch.maxCourses,
        max_storage: patch.maxStorage,
        features: patch.features,
        settings: patch.settings,
        status: patch.status,
        enrollment_date: patch.enrollmentDate,
        contract_start: patch.contractStart,
        contract_end: patch.contractEnd,
        total_learners: patch.totalLearners,
        active_learners: patch.activeLearners,
        completion_rate: patch.completionRate,
        cohorts: patch.cohorts,
        last_activity: patch.lastActivity,
        modules: patch.modules,
        notes: patch.notes,
        tags: patch.tags
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to update organization:', error);
    res.status(500).json({ error: 'Unable to update organization' });
  }
});

app.delete('/api/admin/organizations/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { error } = await supabase.from('organizations').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete organization:', error);
    res.status(500).json({ error: 'Unable to delete organization' });
  }
});

// Organization memberships
app.get('/api/admin/organizations/:orgId/members', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: false });
  if (!access && context.userRole !== 'admin') return;

  try {
    const { data, error } = await supabase
      .from('organization_memberships')
      .select('id, user_id, role, invited_by, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    console.error(`Failed to list organization members for ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to load organization members' });
  }
});

app.post('/api/admin/organizations/:orgId/members', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const { userId, role = 'member' } = req.body || {};

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const context = requireUserContext(req, res);
  if (!context) return;

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access && context.userRole !== 'admin') return;

  try {
    const normalizedRole = String(role || 'member').toLowerCase();
    const payload = {
      org_id: orgId,
      user_id: userId,
      role: normalizedRole,
      invited_by: context.userId ?? null
    };

    const { data, error } = await supabase
      .from('organization_memberships')
      .upsert(payload, { onConflict: 'org_id,user_id' })
      .select('id, org_id, user_id, role, invited_by, created_at, updated_at')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error(`Failed to add organization member for ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to add organization member' });
  }
});

app.delete('/api/admin/organizations/:orgId/members/:membershipId', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, membershipId } = req.params;

  const context = requireUserContext(req, res);
  if (!context) return;

  try {
    const existing = await supabase
      .from('organization_memberships')
      .select('id, org_id, user_id, role')
      .eq('id', membershipId)
      .maybeSingle();

    if (existing.error) throw existing.error;
    const membership = existing.data;

    if (!membership) {
      res.status(204).end();
      return;
    }

    if (membership.org_id !== orgId) {
      res.status(400).json({ error: 'Membership does not belong to organization' });
      return;
    }

    const access = await requireOrgAccess(req, res, orgId, { write: true });
    if (!access && context.userRole !== 'admin' && context.userId !== membership.user_id) {
      return;
    }

    const { error } = await supabase
      .from('organization_memberships')
      .delete()
      .eq('id', membershipId);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error(`Failed to remove organization member ${membershipId}:`, error);
    res.status(500).json({ error: 'Unable to remove organization member' });
  }
});

// Organization workspace
app.get('/api/orgs/:orgId/workspace/access', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  res.json({ data: { orgId, role: access.role } });
});

app.get('/api/orgs/:orgId/workspace', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  try {
    const [plans, notes, items] = await Promise.all([
      supabase
        .from('org_workspace_strategic_plans')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
      supabase
        .from('org_workspace_session_notes')
        .select('*')
        .eq('org_id', orgId)
        .order('note_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('org_workspace_action_items')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
    ]);

    if (plans.error) throw plans.error;
    if (notes.error) throw notes.error;
    if (items.error) throw items.error;

    const strategicPlans = (plans.data ?? []).map(toStrategicPlan);
    const sessionNotes = (notes.data ?? []).map(toSessionNote);
    const actionItems = sortActionItems((items.data ?? []).map(toActionItem));

    res.json({
      data: {
        orgId,
        strategicPlans,
        sessionNotes,
        actionItems
      }
    });
  } catch (error) {
    console.error(`Failed to load workspace for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to load organization workspace' });
  }
});

app.get('/api/orgs/:orgId/workspace/strategic-plans', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  try {
    const { data, error } = await supabase
      .from('org_workspace_strategic_plans')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: (data ?? []).map(toStrategicPlan) });
  } catch (error) {
    console.error(`Failed to fetch strategic plans for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to fetch strategic plans' });
  }
});

app.get('/api/orgs/:orgId/workspace/strategic-plans/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, id } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  try {
    const { data, error } = await supabase
      .from('org_workspace_strategic_plans')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Strategic plan version not found' });
      return;
    }

    res.json({ data: toStrategicPlan(data) });
  } catch (error) {
    console.error(`Failed to fetch strategic plan ${id} for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to fetch strategic plan version' });
  }
});

app.post('/api/orgs/:orgId/workspace/strategic-plans', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const payload = req.body || {};

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  if (!payload.content) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  try {
    const insertPayload = {
      org_id: orgId,
      content: payload.content,
      created_by: payload.createdBy ?? null,
      metadata: payload.metadata ?? {}
    };

    const { data, error } = await supabase
      .from('org_workspace_strategic_plans')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data: toStrategicPlan(data) });
  } catch (error) {
    console.error(`Failed to create strategic plan for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to create strategic plan version' });
  }
});

app.delete('/api/orgs/:orgId/workspace/strategic-plans/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, id } = req.params;

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  try {
    const { error } = await supabase
      .from('org_workspace_strategic_plans')
      .delete()
      .eq('org_id', orgId)
      .eq('id', id);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error(`Failed to delete strategic plan ${id} for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to delete strategic plan version' });
  }
});

app.get('/api/orgs/:orgId/workspace/session-notes', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  try {
    const { data, error } = await supabase
      .from('org_workspace_session_notes')
      .select('*')
      .eq('org_id', orgId)
      .order('note_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: (data ?? []).map(toSessionNote) });
  } catch (error) {
    console.error(`Failed to fetch session notes for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to fetch session notes' });
  }
});

app.post('/api/orgs/:orgId/workspace/session-notes', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const payload = req.body || {};

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  if (!payload.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  try {
    const insertPayload = {
      org_id: orgId,
      title: payload.title,
      body: payload.body ?? null,
      note_date: payload.date ?? new Date().toISOString(),
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      created_by: payload.createdBy ?? null
    };

    const { data, error } = await supabase
      .from('org_workspace_session_notes')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data: toSessionNote(data) });
  } catch (error) {
    console.error(`Failed to create session note for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to create session note' });
  }
});

app.get('/api/orgs/:orgId/workspace/action-items', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;

  const access = await requireOrgAccess(req, res, orgId);
  if (!access) return;

  try {
    const { data, error } = await supabase
      .from('org_workspace_action_items')
      .select('*')
      .eq('org_id', orgId);

    if (error) throw error;
    res.json({ data: sortActionItems((data ?? []).map(toActionItem)) });
  } catch (error) {
    console.error(`Failed to fetch action items for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to fetch action items' });
  }
});

app.post('/api/orgs/:orgId/workspace/action-items', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId } = req.params;
  const payload = req.body || {};

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  if (!payload.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  try {
    const insertPayload = {
      org_id: orgId,
      title: payload.title,
      description: payload.description ?? null,
      assignee: payload.assignee ?? null,
      due_at: payload.dueDate ?? null,
      status: payload.status ?? 'Not Started',
      metadata: payload.metadata ?? {}
    };

    const { data, error } = await supabase
      .from('org_workspace_action_items')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data: toActionItem(data) });
  } catch (error) {
    console.error(`Failed to create action item for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to create action item' });
  }
});

app.put('/api/orgs/:orgId/workspace/action-items/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, id } = req.params;
  const payload = req.body || {};

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  try {
    const updatePayload = {};
    const map = {
      title: 'title',
      description: 'description',
      assignee: 'assignee',
      dueDate: 'due_at',
      status: 'status',
      metadata: 'metadata'
    };

    Object.entries(map).forEach(([key, column]) => {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        updatePayload[column] = payload[key];
      }
    });

    if (Object.keys(updatePayload).length === 0) {
      const { data, error } = await supabase
        .from('org_workspace_action_items')
        .select('*')
        .eq('org_id', orgId)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'Action item not found' });
        return;
      }

      res.json({ data: toActionItem(data) });
      return;
    }

    const { data, error } = await supabase
      .from('org_workspace_action_items')
      .update(updatePayload)
      .eq('org_id', orgId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data: toActionItem(data) });
  } catch (error) {
    console.error(`Failed to update action item ${id} for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to update action item' });
  }
});

app.delete('/api/orgs/:orgId/workspace/action-items/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { orgId, id } = req.params;

  const access = await requireOrgAccess(req, res, orgId, { write: true });
  if (!access) return;

  try {
    const { error } = await supabase
      .from('org_workspace_action_items')
      .delete()
      .eq('org_id', orgId)
      .eq('id', id);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error(`Failed to delete action item ${id} for org ${orgId}:`, error);
    res.status(500).json({ error: 'Unable to delete action item' });
  }
});

// Document library
app.get('/api/admin/documents', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { org_id, user_id, tag, category, search, visibility } = req.query;

  try {
    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (visibility) {
      query = query.eq('visibility', visibility);
    }
    if (org_id) {
      query = query.eq('org_id', org_id);
    }
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (tag) {
      query = query.contains('tags', [tag]);
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    res.status(500).json({ error: 'Unable to fetch documents' });
  }
});

app.post('/api/admin/documents', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};

  if (!payload.name || !payload.category) {
    res.status(400).json({ error: 'name and category are required' });
    return;
  }

  try {
    const insertPayload = {
      id: payload.id ?? undefined,
      name: payload.name,
      filename: payload.filename ?? null,
      url: payload.url ?? null,
      category: payload.category,
      subcategory: payload.subcategory ?? null,
      tags: payload.tags ?? [],
      file_type: payload.fileType ?? null,
      visibility: payload.visibility ?? 'global',
      org_id: payload.orgId ?? null,
      user_id: payload.userId ?? null,
      created_by: payload.createdBy ?? null,
      metadata: payload.metadata ?? {}
    };

    const { data, error } = await supabase
      .from('documents')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create document:', error);
    res.status(500).json({ error: 'Unable to create document' });
  }
});

app.put('/api/admin/documents/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const patch = req.body || {};

  try {
    const updatePayload = {};
    const map = {
      name: 'name',
      filename: 'filename',
      url: 'url',
      category: 'category',
      subcategory: 'subcategory',
      tags: 'tags',
      fileType: 'file_type',
      visibility: 'visibility',
      orgId: 'org_id',
      userId: 'user_id',
      metadata: 'metadata'
    };

    Object.entries(map).forEach(([key, column]) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        updatePayload[column] = patch[key];
      }
    });

    if (Object.keys(updatePayload).length === 0) {
      const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
      if (error) throw error;
      res.json({ data });
      return;
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to update document:', error);
    res.status(500).json({ error: 'Unable to update document' });
  }
});

app.post('/api/admin/documents/:id/download', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { data, error } = await supabase.rpc('increment_document_download', { doc_id: id });
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to record document download:', error);
    res.status(500).json({ error: 'Unable to record download' });
  }
});

app.delete('/api/admin/documents/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete document:', error);
    res.status(500).json({ error: 'Unable to delete document' });
  }
});

// Surveys
app.get('/api/admin/surveys', async (_req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch surveys:', error);
    res.status(500).json({ error: 'Unable to fetch surveys' });
  }
});

app.get('/api/admin/surveys/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error(`Failed to fetch survey ${id}:`, error);
    res.status(500).json({ error: 'Unable to fetch survey' });
  }
});

app.post('/api/admin/surveys', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};

  if (!payload.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  try {
    const insertPayload = {
      id: payload.id ?? undefined,
      title: payload.title,
      description: payload.description ?? null,
      type: payload.type ?? null,
      status: payload.status ?? 'draft',
      sections: payload.sections ?? [],
      branding: payload.branding ?? {},
      settings: payload.settings ?? {},
      assigned_to: payload.assignedTo ?? [],
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('surveys')
      .upsert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to save survey:', error);
    res.status(500).json({ error: 'Unable to save survey' });
  }
});

app.put('/api/admin/surveys/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const patch = req.body || {};

  try {
    const updatePayload = {
      title: patch.title,
      description: patch.description,
      type: patch.type,
      status: patch.status,
      sections: patch.sections,
      branding: patch.branding,
      settings: patch.settings,
      assigned_to: patch.assignedTo,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('surveys')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to update survey:', error);
    res.status(500).json({ error: 'Unable to update survey' });
  }
});

app.delete('/api/admin/surveys/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;

  try {
    const { error } = await supabase.from('surveys').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete survey:', error);
    res.status(500).json({ error: 'Unable to delete survey' });
  }
});

// Notifications
app.get('/api/admin/notifications', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { org_id, user_id } = req.query;
  const context = requireUserContext(req, res);
  if (!context) return;

  const isAdmin = context.userRole === 'admin';

  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (org_id) {
      const access = await requireOrgAccess(req, res, org_id);
      if (!access && !isAdmin) return;
      query = query.eq('org_id', org_id);
    }

    if (user_id) {
      if (!isAdmin && context.userId && user_id !== context.userId) {
        res.status(403).json({ error: 'Cannot view notifications for another user' });
        return;
      }
      query = query.eq('user_id', user_id);
    } else if (!isAdmin) {
      if (!context.userId) {
        res.status(400).json({ error: 'user_id is required for non-admin queries' });
        return;
      }
      query = query.eq('user_id', context.userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const filtered = isAdmin
      ? data
      : (data || []).filter((note) => {
          if (note.user_id) return note.user_id === context.userId;
          if (note.org_id) return true;
          return false;
        });

    res.json({ data: filtered });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ error: 'Unable to fetch notifications' });
  }
});

app.post('/api/admin/notifications', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const payload = req.body || {};
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';

  if (!payload.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  if (payload.orgId) {
    const access = await requireOrgAccess(req, res, payload.orgId, { write: true });
    if (!access && !isAdmin) return;
  } else if (payload.userId) {
    if (!isAdmin && payload.userId !== context.userId) {
      res.status(403).json({ error: 'Cannot create notifications for another user' });
      return;
    }
  } else if (!isAdmin) {
    res.status(403).json({ error: 'Only admins can create global notifications' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        id: payload.id ?? undefined,
        title: payload.title,
        body: payload.body ?? null,
        org_id: payload.orgId ?? null,
        user_id: payload.userId ?? null,
        read: payload.read ?? false
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to create notification:', error);
    res.status(500).json({ error: 'Unable to create notification' });
  }
});

app.post('/api/admin/notifications/:id/read', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const { read = true } = req.body || {};
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';

  try {
    const existing = await supabase
      .from('notifications')
      .select('org_id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    const note = existing.data;
    if (!note) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    if (!isAdmin) {
      if (note.user_id) {
        if (note.user_id !== context.userId) {
          res.status(403).json({ error: 'Cannot modify another user\'s notification' });
          return;
        }
      } else if (note.org_id) {
        const access = await requireOrgAccess(req, res, note.org_id);
        if (!access) return;
      } else {
        res.status(403).json({ error: 'Cannot modify global notification' });
        return;
      }
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ read })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to update notification status:', error);
    res.status(500).json({ error: 'Unable to update notification' });
  }
});

app.delete('/api/admin/notifications/:id', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id } = req.params;
  const context = requireUserContext(req, res);
  if (!context) return;
  const isAdmin = context.userRole === 'admin';

  try {
    const existing = await supabase
      .from('notifications')
      .select('org_id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    const note = existing.data;
    if (!note) {
      res.status(204).end();
      return;
    }

    if (!isAdmin) {
      if (note.user_id) {
        if (note.user_id !== context.userId) {
          res.status(403).json({ error: 'Cannot delete another user\'s notification' });
          return;
        }
      } else if (note.org_id) {
        const access = await requireOrgAccess(req, res, note.org_id, { write: true });
        if (!access) return;
      } else {
        res.status(403).json({ error: 'Cannot delete global notification' });
        return;
      }
    }

    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete notification:', error);
    res.status(500).json({ error: 'Unable to delete notification' });
  }
});

app.post('/api/analytics/events', async (req, res) => {
  // In demo/E2E mode, just acknowledge the analytics event
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    res.status(201).json({ 
      success: true, 
      message: 'Event tracked (demo mode)',
      data: { id: req.body?.id || 'demo-event-' + Date.now() }
    });
    return;
  }
  
  if (!ensureSupabase(res)) return;
  const { id, user_id, course_id, lesson_id, module_id, event_type, session_id, user_agent, payload } = req.body || {};

  if (!event_type) {
    res.status(400).json({ error: 'event_type is required' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('analytics_events')
      .insert({
        id: id ?? undefined,
        user_id: user_id ?? null,
        course_id: course_id ?? null,
        lesson_id: lesson_id ?? null,
        module_id: module_id ?? null,
        event_type,
        session_id: session_id ?? null,
        user_agent: user_agent ?? null,
        payload: payload ?? {}
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to record analytics event:', error);
    res.status(500).json({ error: 'Unable to record analytics event' });
  }
});

app.get('/api/analytics/events', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { user_id, course_id, limit = 200 } = req.query;

  try {
    let query = supabase
      .from('analytics_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit, 10));

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch analytics events:', error);
    res.status(500).json({ error: 'Unable to fetch analytics events' });
  }
});

app.post('/api/analytics/journeys', async (req, res) => {
  // In demo/E2E mode, just acknowledge the journey tracking
  if (!supabase && (E2E_TEST_MODE || DEV_FALLBACK)) {
    res.status(201).json({ 
      success: true, 
      message: 'Journey tracked (demo mode)',
      data: { 
        user_id: req.body?.user_id || 'demo-user',
        course_id: req.body?.course_id || 'demo-course'
      }
    });
    return;
  }
  
  if (!ensureSupabase(res)) return;
  const { user_id, course_id, journey } = req.body || {};

  if (!user_id || !course_id) {
    res.status(400).json({ error: 'user_id and course_id are required' });
    return;
  }

  try {
    const payload = {
      user_id,
      course_id,
      started_at: journey?.startedAt ?? new Date().toISOString(),
      last_active_at: journey?.lastActiveAt ?? new Date().toISOString(),
      completed_at: journey?.completedAt ?? null,
      total_time_spent: journey?.totalTimeSpent ?? 0,
      sessions_count: journey?.sessionsCount ?? 0,
      progress_percentage: journey?.progressPercentage ?? 0,
      engagement_score: journey?.engagementScore ?? 0,
      milestones: journey?.milestones ?? [],
      drop_off_points: journey?.dropOffPoints ?? [],
      path_taken: journey?.pathTaken ?? []
    };

    const { data, error } = await supabase
      .from('learner_journeys')
      .upsert(payload, { onConflict: 'user_id,course_id' })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Failed to upsert learner journey:', error);
    res.status(500).json({ error: 'Unable to save learner journey' });
  }
});

app.get('/api/analytics/journeys', async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { user_id, course_id } = req.query;

  try {
    let query = supabase
      .from('learner_journeys')
      .select('*');

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Failed to fetch learner journeys:', error);
    res.status(500).json({ error: 'Unable to fetch learner journeys' });
  }
});

const distPath = path.resolve(__dirname, '../dist');

// Serve static files from the dist directory
app.use(express.static(distPath));

// For SPA client-side routing — serve index.html for unknown routes
// Use a non-wildcard param pattern to avoid path-to-regexp parsing issues on some Node/express versions.
// Serve index.html for SPA routes that aren't API or WS. Use a middleware to avoid
// registering a path pattern that trips path-to-regexp in some environments.
app.use((req, res, next) => {
  // Only handle GET requests that are not API or WS paths
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/_next')) return next();

  const indexFile = path.join(distPath, 'index.html');
  res.sendFile(indexFile, (err) => {
    if (err) return next(err);
  });
});

const server = app.listen(port, () => {
  console.log(`Serving production build from ${distPath} at http://localhost:${port}`);
});

// Initialize WebSocket server (ws) to handle realtime broadcasts at /ws
try {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log('WS client connected', req.socket.remoteAddress);

    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());
        if (msg.type === 'subscribe' && msg.topic) {
          subscribeClientToTopic(ws, msg.topic);
        } else if (msg.type === 'unsubscribe' && msg.topic) {
          unsubscribeClientFromTopic(ws, msg.topic);
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (err) {
        console.warn('Invalid WS message', err);
      }
    });

    ws.on('close', () => {
      for (const [, set] of topicSubscribers) set.delete(ws);
    });
  });

  console.log('WebSocket server initialized at /ws');
} catch (err) {
  console.warn('Failed to initialize WebSocket server:', err);
}
