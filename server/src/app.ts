import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import axios from 'axios';
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
import resourceRoutes from './routes/resource.routes';
import showcaseRoutes from './routes/showcase.routes';
import messageRoutes from './routes/message.routes';
import teamRoutes from './routes/team.routes';
import subscriptionRoutes from './routes/subscription.routes';
import noteRoutes from './routes/note.routes';
import emailRoutes from './routes/email.routes';
import googleWarmingRoutes from './routes/google-warming.routes';
import twoFactorRoutes from './routes/two-factor.routes';
import mirrorRoutes from './mirror/routes/mirror.routes';
import adminMirrorRoutes from './mirror/routes/admin-mirror.routes';
import manualRoutes from './manual/routes/manual.routes';
import adminManualRoutes from './manual/routes/admin-manual.routes';
import aiRoutes from './routes/ai.routes';
import aiBotRoutes from './routes/ai-bot.routes';
import bannerRoutes from './routes/banner.routes';
import pluginRoutes from './routes/plugin.routes';
import adminPluginRoutes from './routes/plugin.admin.routes';
import softwareRoutes from './routes/software.routes';
import adminSoftwareRoutes from './routes/software.admin.routes';
import backupRoutes from './routes/backup.routes';
import temporaryNetdiskRoutes from './routes/temporary-netdisk.routes';

import rateLimit from 'express-rate-limit';
import { errorHandler } from './middlewares/error.middleware';
import { checkMaintenanceMode } from './middlewares/maintenance.middleware';
import { requestContext } from './middlewares/request-context.middleware';
import { notFoundHandler } from './middlewares/not-found.middleware';
import { createRateLimitHandler } from './middlewares/rate-limit.middleware';
import { csrfProtection } from './middlewares/csrf.middleware';
import { readPositiveInt } from './config/env';

const app = express();

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
app.use(compression({ threshold: 1024 })); // Only compress responses larger than 1KB

// Security Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images to be loaded from this server
  }),
);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_EXTRA_ORIGINS?.split(',').map((o) => o.trim()) ?? []),
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        (process.env.NODE_ENV === 'development' &&
          (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')))
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    exposedHeaders: ['Content-Length', 'Accept-Ranges', 'Content-Range', 'Content-Disposition'],
  }),
);

app.use(cookieParser());

type BodyVerifyCallback = NonNullable<NonNullable<Parameters<typeof express.json>[0]>['verify']>;

const captureAiBotCallbackRawBody: BodyVerifyCallback = (req, _res, buf) => {
  const requestUrl = (req as Request).originalUrl || req.url || '';
  const requestPath = requestUrl.split('?')[0] || '';
  if (/^\/api\/ai-bots\/callback\/[^/]+$/.test(requestPath)) {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
  }
};

app.use(express.json({ limit: '2mb', verify: captureAiBotCallbackRawBody }));
app.use(express.urlencoded({ limit: '2mb', extended: true, verify: captureAiBotCallbackRawBody }));
app.use(
  '/api/ai-bots/callback',
  express.text({
    limit: '2mb',
    type: ['text/*', 'application/xml'],
    verify: captureAiBotCallbackRawBody,
  }),
);
app.use(csrfProtection);

// Serve uploads folder statically using process.cwd() to resolve correctly in both dev (src/) and prod (dist/src/)
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'uploads'), {
    maxAge: '30d', // Enable 30-day browser caching
    immutable: true, // Asset files do not change once uploaded (they are versioned/hashed if updated)
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
// General admin routes: /api/admin/*
app.use('/api/admin', adminRoutes);
// Plugin admin sub-routes: /api/admin/plugins/*
app.use('/api/admin', adminPluginRoutes);
// Software admin sub-routes: /api/admin/softwares/*
app.use('/api/admin', adminSoftwareRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/roadmaps', roadmapRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/showcase', showcaseRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/google-warming', googleWarmingRoutes);
app.use('/api/two-factor', twoFactorRoutes);
app.use('/api/mirror', mirrorRoutes);
app.use('/api/admin/mirror', adminMirrorRoutes);
app.use('/api/manual', manualRoutes);
app.use('/api/admin/manual', adminManualRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-bots', aiBotRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/plugins', pluginRoutes);
app.use('/api/softwares', softwareRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/temporary-netdisk', temporaryNetdiskRoutes);

// Validate proxy image URL to prevent SSRF attacks
const isAllowedProxyUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    // Only allow http/https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    // Block private/loopback/link-local addresses
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^169\.254\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

app.get('/api/proxy/image', async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).send('Missing url parameter');
    return;
  }
  if (!isAllowedProxyUrl(url)) {
    res.status(403).send('URL not allowed');
    return;
  }
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 10000,
      maxRedirects: 3,
    });
    const contentType = String(response.headers['content-type'] || 'image/jpeg');
    // Only allow image content types
    if (!contentType.startsWith('image/')) {
      res.status(400).send('URL does not point to an image');
      return;
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    response.data.pipe(res);
  } catch (error) {
    res.status(500).send('Failed to proxy image');
  }
});

app.get('/', (req, res) => {
  res.send('3D Personal Learning Platform API');
});

app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

export default app;
