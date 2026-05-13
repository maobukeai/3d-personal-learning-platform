import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
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
import webhookRoutes from './routes/webhook.routes';

import { errorHandler } from './middlewares/error.middleware';
import { checkMaintenanceMode } from './middlewares/maintenance.middleware';

const app = express();

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow images to be loaded from this server
}));

const allowedOrigins = [
  'http://localhost:5173', // Vite default
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve uploads folder statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Maintenance check
app.use(checkMaintenanceMode);

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
app.use('/api/webhooks', webhookRoutes);


app.get('/', (req, res) => {
  res.send('3D Personal Learning Platform API');
});

// Error handling middleware
app.use(errorHandler);

export default app;
