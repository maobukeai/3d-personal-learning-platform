import type { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './health.routes';
import { registerModelRoutes } from './model.routes';
import { registerYjsRoutes } from './yjs.routes';
import { registerAiRoutes } from './ai.routes';
import { registerAiBotRoutes } from './ai-bots.routes';
import { registerTaskRoutes } from './task.routes';
import { registerDiscussionRoutes } from './discussion.routes';
import { registerNoteRoutes } from './note.routes';
import { registerResourceRoutes } from './resource.routes';
import { registerMaterialRoutes } from './material.routes';
import { registerAssetRoutes } from './asset.routes';
import { registerLessonRoutes } from './lesson.routes';
import { registerAuthRoutes } from './auth.routes';
import { registerCourseRoutes } from './course.routes';
import { registerTeamRoutes } from './team.routes';
import { registerProjectRoutes } from './project.routes';
import { registerMessageRoutes } from './message.routes';
import { registerShowcaseRoutes } from './showcase.routes';
import { registerSubscriptionRoutes } from './subscription.routes';
import { registerAdminRoutes } from './admin.routes';
import { registerPluginAdminRoutes } from './plugin-admin.routes';
import { registerSoftwareAdminRoutes } from './software-admin.routes';
import { registerAdminMirrorRoutes } from './admin-mirror.routes';
import { registerAdminManualRoutes } from './admin-manual.routes';
import { registerBackupRoutes } from './backup.routes';
import { registerBannerRoutes } from './banner.routes';
import { registerFeedbackRoutes } from './feedback.routes';
import { registerGoogleWarmingRoutes } from './google-warming.routes';
import { registerNotificationRoutes } from './notification.routes';
import { registerRoadmapRoutes } from './roadmap.routes';
import { registerEmailRoutes } from './email.routes';
import { registerTwoFactorRoutes } from './two-factor.routes';
import { registerMirrorRoutes } from './mirror.routes';
import { registerManualRoutes } from './manual.routes';
import { registerTemporaryNetdiskRoutes } from './temporary-netdisk.routes';
import { registerPluginRoutes } from './plugin.routes';
import { registerSoftwareRoutes } from './software.routes';
import { registerWebsiteRoutes } from './website.routes';
import { registerStaticUploadsRoutes } from './static-uploads.routes';

export function registerAllFastifyRoutes(app: FastifyInstance) {
  // 1. 全局与根节点路由及静态文件服务
  registerHealthRoutes(app);
  registerYjsRoutes(app);
  registerStaticUploadsRoutes(app);

  // 2. 带有完整子域的路由模块，统一挂载在 /api 与 /api/fastify 下
  app.register(registerAuthRoutes, { prefix: '/api' });
  app.register(registerAuthRoutes, { prefix: '/api/fastify' });

  app.register(registerAdminRoutes, { prefix: '/api' });
  app.register(registerAdminRoutes, { prefix: '/api/fastify' });

  app.register(registerPluginAdminRoutes, { prefix: '/api' });
  app.register(registerPluginAdminRoutes, { prefix: '/api/fastify' });

  app.register(registerSoftwareAdminRoutes, { prefix: '/api' });
  app.register(registerSoftwareAdminRoutes, { prefix: '/api/fastify' });

  app.register(registerAdminMirrorRoutes, { prefix: '/api' });
  app.register(registerAdminMirrorRoutes, { prefix: '/api/fastify' });

  app.register(registerAdminManualRoutes, { prefix: '/api' });
  app.register(registerAdminManualRoutes, { prefix: '/api/fastify' });

  app.register(registerTeamRoutes, { prefix: '/api' });
  app.register(registerTeamRoutes, { prefix: '/api/fastify' });

  app.register(registerBannerRoutes, { prefix: '/api' });
  app.register(registerBannerRoutes, { prefix: '/api/fastify' });

  app.register(registerNotificationRoutes, { prefix: '/api' });
  app.register(registerNotificationRoutes, { prefix: '/api/fastify' });

  app.register(registerMessageRoutes, { prefix: '/api' });
  app.register(registerMessageRoutes, { prefix: '/api/fastify' });

  app.register(registerPluginRoutes, { prefix: '/api' });
  app.register(registerPluginRoutes, { prefix: '/api/fastify' });

  app.register(registerSoftwareRoutes, { prefix: '/api' });
  app.register(registerSoftwareRoutes, { prefix: '/api/fastify' });

  app.register(registerProjectRoutes, { prefix: '/api' });
  app.register(registerProjectRoutes, { prefix: '/api/fastify' });

  app.register(registerCourseRoutes, { prefix: '/api' });
  app.register(registerCourseRoutes, { prefix: '/api/fastify' });

  app.register(registerLessonRoutes, { prefix: '/api' });
  app.register(registerLessonRoutes, { prefix: '/api/fastify' });

  app.register(registerShowcaseRoutes, { prefix: '/api' });
  app.register(registerShowcaseRoutes, { prefix: '/api/fastify' });

  app.register(registerSubscriptionRoutes, { prefix: '/api' });
  app.register(registerSubscriptionRoutes, { prefix: '/api/fastify' });

  app.register(registerBackupRoutes, { prefix: '/api' });
  app.register(registerBackupRoutes, { prefix: '/api/fastify' });

  app.register(registerFeedbackRoutes, { prefix: '/api' });
  app.register(registerFeedbackRoutes, { prefix: '/api/fastify' });

  app.register(registerGoogleWarmingRoutes, { prefix: '/api' });
  app.register(registerGoogleWarmingRoutes, { prefix: '/api/fastify' });

  app.register(registerRoadmapRoutes, { prefix: '/api' });
  app.register(registerRoadmapRoutes, { prefix: '/api/fastify' });

  app.register(registerEmailRoutes, { prefix: '/api' });
  app.register(registerEmailRoutes, { prefix: '/api/fastify' });

  app.register(registerTwoFactorRoutes, { prefix: '/api' });
  app.register(registerTwoFactorRoutes, { prefix: '/api/fastify' });

  app.register(registerMirrorRoutes, { prefix: '/api' });
  app.register(registerManualRoutes, { prefix: '/api' });

  app.register(registerTemporaryNetdiskRoutes, { prefix: '/api' });
  app.register(registerTemporaryNetdiskRoutes, { prefix: '/api/fastify' });

  app.register(registerNoteRoutes, { prefix: '/api' });
  app.register(registerNoteRoutes, { prefix: '/api/fastify' });

  app.register(registerWebsiteRoutes, { prefix: '/api' });
  app.register(registerWebsiteRoutes, { prefix: '/api/fastify' });

  app.register(registerResourceRoutes, { prefix: '/api' });
  app.register(registerResourceRoutes, { prefix: '/api/fastify' });

  // 3. 相对路径领域模块（内部形如 /share/:shareId 或 /），挂载到各自领域的专属前缀上
  app.register(registerAssetRoutes, { prefix: '/api/assets' });
  app.register(registerAssetRoutes, { prefix: '/api/fastify/assets' });

  app.register(registerMaterialRoutes, { prefix: '/api/materials' });
  app.register(registerMaterialRoutes, { prefix: '/api/fastify/materials' });

  app.register(registerDiscussionRoutes, { prefix: '/api/discussions' });
  app.register(registerDiscussionRoutes, { prefix: '/api/fastify/discussions' });

  app.register(registerTaskRoutes, { prefix: '/api/tasks' });
  app.register(registerTaskRoutes, { prefix: '/api/fastify/tasks' });

  app.register(registerModelRoutes, { prefix: '/api/models' });
  app.register(registerModelRoutes, { prefix: '/api/fastify/models' });

  app.register(registerAiBotRoutes, { prefix: '/api/ai-bots' });
  app.register(registerAiBotRoutes, { prefix: '/api/fastify/ai-bots' });

  app.register(registerAiRoutes, { prefix: '/api/ai' });
  app.register(registerAiRoutes, { prefix: '/api/fastify/ai' });
}
