import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import feedbackRoutes from './routes/feedback.routes';
import courseRoutes from './routes/course.routes';
import lessonRoutes from './routes/lesson.routes';
import taskRoutes from './routes/task.routes';
import assetRoutes from './routes/asset.routes';
import discussionRoutes from './routes/discussion.routes';
import notificationRoutes from './routes/notification.routes';
import roadmapRoutes from './routes/roadmap.routes';
import projectRoutes from './routes/project.routes';
import materialRoutes from './routes/material.routes';
import showcaseRoutes from './routes/showcase.routes';
import messageRoutes from './routes/message.routes';
import teamRoutes from './routes/team.routes';
import subscriptionRoutes from './routes/subscription.routes';
import noteRoutes from './routes/note.routes';
import emailRoutes from './routes/email.routes';
import mirrorRoutes from './mirror/routes/mirror.routes';
import adminMirrorRoutes from './mirror/routes/admin-mirror.routes';
import manualRoutes from './manual/routes/manual.routes';
import adminManualRoutes from './manual/routes/admin-manual.routes';

import rateLimit from 'express-rate-limit';
import { errorHandler } from './middlewares/error.middleware';
import { checkMaintenanceMode } from './middlewares/maintenance.middleware';
import { requestContext } from './middlewares/request-context.middleware';
import { notFoundHandler } from './middlewares/not-found.middleware';
import { createRateLimitHandler } from './middlewares/rate-limit.middleware';

const app = express();

const readPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseTrustProxy = (value: string | undefined) => {
  if (!value) return 1;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : value;
};

// Trust proxy - essential for getting real client IP when behind a reverse proxy (Nginx, etc.)
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

app.use(requestContext);

// Security Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images to be loaded from this server
  }),
);

const allowedOrigins = [
  'http://localhost:5173', // Vite default
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve uploads folder statically using process.cwd() to resolve correctly in both dev (src/) and prod (dist/src/)
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'uploads'), {
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (path.extname(filePath).toLowerCase() === '.svg') {
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
        );
      }
    },
  }),
);

// Maintenance check
app.use(checkMaintenanceMode);

// Global API rate limiting
const globalLimiter = rateLimit({
  windowMs: readPositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max:
    process.env.NODE_ENV === 'development'
      ? 10000
      : readPositiveInt(process.env.API_RATE_LIMIT_MAX, 3000),
  handler: createRateLimitHandler('请求过于频繁，请稍后再试'),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const requestPath = req.originalUrl.split('?')[0] || req.originalUrl;
    return (
      [
        '/api/auth/settings',
        '/api/auth/refresh',
        '/api/auth/logout',
        '/api/auth/login',
        '/api/auth/login/2fa',
        '/api/auth/register',
      ].includes(requestPath) || requestPath.startsWith('/api/auth/email/')
    );
  },
});
app.use('/api', globalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/roadmaps', roadmapRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/showcase', showcaseRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/mirror', mirrorRoutes);
app.use('/api/admin/mirror', adminMirrorRoutes);
app.use('/api/manual', manualRoutes);
app.use('/api/admin/manual', adminManualRoutes);

app.get('/', (req, res) => {
  res.send('3D Personal Learning Platform API');
});

app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

export default app;
