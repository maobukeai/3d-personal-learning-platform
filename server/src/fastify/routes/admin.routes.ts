import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as dashboardController from '../../controllers/admin/dashboard.controller';
import * as settingsController from '../../controllers/admin/settings.controller';
import * as userController from '../../controllers/admin/user.controller';
import * as courseController from '../../controllers/admin/course.controller';
import * as contentController from '../../controllers/admin/content.controller';
import * as managementController from '../../controllers/admin/management.controller';
import * as teamController from '../../controllers/admin/team.controller';
import * as subscriptionController from '../../controllers/admin/subscription.controller';
import * as bannerController from '../../controllers/admin/banner.controller';
import * as categoryController from '../../controllers/category.controller';
import * as assetController from '../../controllers/asset.controller';
import * as activationCodeController from '../../controllers/activationCode.controller';
import * as storageController from '../../controllers/admin/storage.controller';
import * as cloudflareController from '../../controllers/admin/cloudflare.controller';
import { updateSettingsSchema, courseSchema, lessonSchema } from '../../utils/schemas';
import { fastifyAuthenticate, fastifyRequireAdmin } from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';
import prisma from '../../services/prisma';
import { QueueService } from '../../services/queue.service';
import {
  auditService,
  AuditAction,
  AuditModule,
  type AuditRequest,
} from '../../services/audit.service';
import { AppError } from '../../utils/error';
import { logger } from '../../utils/logger';
import path from 'path';
import type { UploadedFile } from '../../types/upload';

/**
 * Fastify 管理后台路由（原生 Fastify handler，已移除 adaptHandler 桥接）。
 *
 * 挂载前缀: /api/fastify/admin
 *  全部端点需鉴权 + ADMIN 角色（对齐 Express authenticate + isAdmin）。
 *
 * 所有 controller 已改造为 (req: AdminRequest, reply: FastifyReply) 签名，
 * 路由层直接传递 controller 函数，不再使用适配器。
 *
 * 文件上传端点（4 个）使用 fastify-upload 中间件替代 multer：
 *  - POST /settings/upload-logo     fastifyUpload([{ name: 'logo', maxCount: 1 }])
 *  - POST /settings/upload-favicon  fastifyUpload([{ name: 'favicon', maxCount: 1 }])
 *  - POST /banners/upload            fastifyUpload([{ name: 'banner_image', maxCount: 1 }])
 *  - POST /storage-configs/:id/files fastifyUpload([{ name: 'file', maxCount: 1 }])
 */

// --- Param schemas (all string ids) ---
const idParams = z.object({ id: z.string().min(1) });
const applicationIdParams = z.object({ applicationId: z.string().min(1) });
const invitationIdParams = z.object({ invitationId: z.string().min(1) });
const teamIdUserIdParams = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
});
const zoneIdParams = z.object({ zoneId: z.string().min(1) });
const zoneIdRecordIdParams = z.object({
  zoneId: z.string().min(1),
  recordId: z.string().min(1),
});

// Admin AI test rate limit (对齐 Express adminAiTestLimiter: 10/min)
const aiTestRateLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

export const registerAdminRoutes = (app: FastifyInstance): void => {
  const auth = { preHandler: [fastifyAuthenticate, fastifyRequireAdmin] };

  // ===== Dashboard / Stats / Logs / Broadcasts =====
  app.get('/admin/stats', { ...auth }, async (request, reply) => {
    return dashboardController.getAdminStats(request, reply);
  });

  app.get('/admin/audit-logs', { ...auth }, async (request, reply) => {
    return dashboardController.getAuditLogs(request, reply);
  });

  app.get('/admin/broadcasts', { ...auth }, async (request, reply) => {
    return dashboardController.getBroadcasts(request, reply);
  });

  app.post('/admin/broadcast', { ...auth }, async (request, reply) => {
    return dashboardController.sendBroadcast(request, reply);
  });

  app.delete(
    '/admin/broadcasts/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return dashboardController.deleteBroadcast(request, reply);
    },
  );

  app.post(
    '/admin/broadcasts/:id/toggle-offline',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return dashboardController.toggleBroadcastOffline(request, reply);
    },
  );

  app.get('/admin/management-insights', { ...auth }, async (request, reply) => {
    return managementController.getManagementInsights(request, reply);
  });

  // ===== Settings =====
  app.get('/admin/settings', { ...auth }, async (request, reply) => {
    return settingsController.getSettings(request, reply);
  });

  app.post(
    '/admin/settings',
    { ...auth, schema: { body: updateSettingsSchema } },
    async (request, reply) => {
      return settingsController.updateSettings(request, reply);
    },
  );

  app.post(
    '/admin/settings/test-smtp',
    { ...auth, config: aiTestRateLimit },
    async (request, reply) => {
      return settingsController.testSmtp(request, reply);
    },
  );

  app.post(
    '/admin/settings/test-ai',
    { ...auth, config: aiTestRateLimit },
    async (request, reply) => {
      return settingsController.testAi(request, reply);
    },
  );

  app.post(
    '/admin/settings/ai-models',
    { ...auth, config: aiTestRateLimit },
    async (request, reply) => {
      return settingsController.listAiModels(request, reply);
    },
  );

  app.post('/admin/settings/cleanup-storage', { ...auth }, async (request, reply) => {
    return settingsController.cleanupStorage(request, reply);
  });

  app.post(
    '/admin/settings/upload-logo',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([{ name: 'logo', maxCount: 1 }]),
      ],
    },
    async (request, reply) => {
      return settingsController.uploadBrandingLogo(request, reply);
    },
  );

  app.post(
    '/admin/settings/upload-favicon',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([{ name: 'favicon', maxCount: 1 }]),
      ],
    },
    async (request, reply) => {
      return settingsController.uploadBrandingFavicon(request, reply);
    },
  );

  // ===== Users =====
  app.get('/admin/users/overview', { ...auth }, async (request, reply) => {
    return userController.getUserOverview(request, reply);
  });

  app.get('/admin/users', { ...auth }, async (request, reply) => {
    return userController.getUsers(request, reply);
  });

  app.post('/admin/users', { ...auth }, async (request, reply) => {
    return userController.createUser(request, reply);
  });

  app.put('/admin/users/batch', { ...auth }, async (request, reply) => {
    return userController.batchUpdateUsers(request, reply);
  });

  app.post('/admin/users/batch/revoke-sessions', { ...auth }, async (request, reply) => {
    return userController.batchRevokeUserSessions(request, reply);
  });

  app.put('/admin/users/:id', { ...auth, schema: { params: idParams } }, async (request, reply) => {
    return userController.updateUser(request, reply);
  });

  app.post(
    '/admin/users/:id/reset-password',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return userController.resetUserPassword(request, reply);
    },
  );

  app.post(
    '/admin/users/:id/revoke-sessions',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return userController.revokeUserSessions(request, reply);
    },
  );

  app.put(
    '/admin/users/:id/role',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return userController.updateUserRole(request, reply);
    },
  );

  app.delete(
    '/admin/users/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return userController.deleteUser(request, reply);
    },
  );

  // ===== Feedback (admin) =====
  app.get('/admin/feedback', { ...auth }, async (request, reply) => {
    return contentController.getAllFeedback(request, reply);
  });

  app.put('/admin/feedback/batch-status', { ...auth }, async (request, reply) => {
    return contentController.batchUpdateFeedbackStatus(request, reply);
  });

  app.delete('/admin/feedback/batch', { ...auth }, async (request, reply) => {
    return contentController.batchDeleteFeedback(request, reply);
  });

  app.put(
    '/admin/feedback/:id/status',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return contentController.updateFeedbackStatus(request, reply);
    },
  );

  app.delete(
    '/admin/feedback/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return contentController.deleteFeedback(request, reply);
    },
  );

  // ===== Roadmaps =====
  app.get('/admin/roadmaps', { ...auth }, async (request, reply) => {
    return courseController.getAllRoadmaps(request, reply);
  });

  app.post('/admin/roadmaps', { ...auth }, async (request, reply) => {
    return courseController.createRoadmap(request, reply);
  });

  app.post('/admin/roadmaps/ai-generate', { ...auth }, async (request, reply) => {
    return courseController.aiGenerateRoadmap(request, reply);
  });

  app.put(
    '/admin/roadmaps/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return courseController.updateRoadmap(request, reply);
    },
  );

  app.delete(
    '/admin/roadmaps/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return courseController.deleteRoadmap(request, reply);
    },
  );

  app.post('/admin/roadmaps/steps', { ...auth }, async (request, reply) => {
    return courseController.createRoadmapStep(request, reply);
  });

  app.put(
    '/admin/roadmaps/steps/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return courseController.updateRoadmapStep(request, reply);
    },
  );

  app.delete(
    '/admin/roadmaps/steps/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return courseController.deleteRoadmapStep(request, reply);
    },
  );

  // ===== Course categories =====
  app.get('/admin/course-categories', { ...auth }, async (request, reply) => {
    return courseController.getAllCourseCategories(request, reply);
  });

  app.post('/admin/course-categories', { ...auth }, async (request, reply) => {
    return courseController.createCourseCategory(request, reply);
  });

  app.put(
    '/admin/course-categories/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return courseController.updateCourseCategory(request, reply);
    },
  );

  app.delete(
    '/admin/course-categories/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return courseController.deleteCourseCategory(request, reply);
    },
  );

  // ===== Courses =====
  app.get('/admin/courses', { ...auth }, async (request, reply) => {
    return courseController.getAllCourses(request, reply);
  });

  app.post(
    '/admin/courses',
    { ...auth, schema: { body: courseSchema } },
    async (request, reply) => {
      return courseController.createCourse(request, reply);
    },
  );

  app.post('/admin/courses/batch', { ...auth }, async (request, reply) => {
    return courseController.createCourseWithLessons(request, reply);
  });

  app.post('/admin/courses/parse-external', { ...auth }, async (request, reply) => {
    return courseController.parseExternalLink(request, reply);
  });

  app.put('/admin/courses/batch-status', { ...auth }, async (request, reply) => {
    return courseController.batchUpdateCourseStatus(request, reply);
  });

  app.delete('/admin/courses/batch', { ...auth }, async (request, reply) => {
    return courseController.batchDeleteCourses(request, reply);
  });

  app.put(
    '/admin/courses/:id',
    { ...auth, schema: { params: idParams, body: courseSchema } },
    async (request, reply) => {
      return courseController.updateCourse(request, reply);
    },
  );

  app.delete(
    '/admin/courses/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return courseController.deleteCourse(request, reply);
    },
  );

  app.post(
    '/admin/courses/lessons',
    { ...auth, schema: { body: lessonSchema } },
    async (request, reply) => {
      return courseController.createLesson(request, reply);
    },
  );

  app.put(
    '/admin/courses/lessons/:id',
    { ...auth, schema: { params: idParams, body: lessonSchema } },
    async (request, reply) => {
      return courseController.updateLesson(request, reply);
    },
  );

  app.delete(
    '/admin/courses/lessons/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return courseController.deleteLesson(request, reply);
    },
  );

  // ===== Teams =====
  app.get('/admin/teams', { ...auth }, async (request, reply) => {
    return teamController.getAllTeams(request, reply);
  });

  app.post('/admin/teams', { ...auth }, async (request, reply) => {
    return teamController.createTeam(request, reply);
  });

  app.put('/admin/teams/batch', { ...auth }, async (request, reply) => {
    return teamController.batchUpdateTeams(request, reply);
  });

  app.delete('/admin/teams/batch', { ...auth }, async (request, reply) => {
    return teamController.batchDeleteTeams(request, reply);
  });

  app.put(
    '/admin/teams/applications/:applicationId',
    { ...auth, schema: { params: applicationIdParams } },
    async (request, reply) => {
      return teamController.respondToTeamApplication(request, reply);
    },
  );

  app.delete(
    '/admin/teams/invitations/:invitationId',
    { ...auth, schema: { params: invitationIdParams } },
    async (request, reply) => {
      return teamController.cancelTeamInvitation(request, reply);
    },
  );

  app.get(
    '/admin/teams/:id/detail',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return teamController.getTeamDetail(request, reply);
    },
  );

  app.put('/admin/teams/:id', { ...auth, schema: { params: idParams } }, async (request, reply) => {
    return teamController.updateTeam(request, reply);
  });

  app.delete(
    '/admin/teams/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return teamController.deleteTeam(request, reply);
    },
  );

  app.post(
    '/admin/teams/:teamId/members',
    { ...auth, schema: { params: z.object({ teamId: z.string().min(1) }) } },
    async (request, reply) => {
      return teamController.addTeamMember(request, reply);
    },
  );

  app.put(
    '/admin/teams/:teamId/members/:userId/role',
    { ...auth, schema: { params: teamIdUserIdParams } },
    async (request, reply) => {
      return teamController.updateTeamMemberRole(request, reply);
    },
  );

  app.delete(
    '/admin/teams/:teamId/members/:userId',
    { ...auth, schema: { params: teamIdUserIdParams } },
    async (request, reply) => {
      return teamController.removeTeamMember(request, reply);
    },
  );

  // ===== Asset categories =====
  app.get('/admin/asset-categories', { ...auth }, async (request, reply) => {
    return categoryController.getAllCategories(request, reply);
  });

  app.post('/admin/asset-categories', { ...auth }, async (request, reply) => {
    return categoryController.adminCreateCategory(request, reply);
  });

  app.put(
    '/admin/asset-categories/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return categoryController.adminUpdateCategory(request, reply);
    },
  );

  app.delete(
    '/admin/asset-categories/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return categoryController.adminDeleteCategory(request, reply);
    },
  );

  // ===== Materials audit =====
  app.get('/admin/materials', { ...auth }, async (request, reply) => {
    return contentController.getAllMaterialsForAdmin(request, reply);
  });

  app.put('/admin/materials/batch-status', { ...auth }, async (request, reply) => {
    return contentController.batchUpdateMaterialStatus(request, reply);
  });

  app.put(
    '/admin/materials/:id/status',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return contentController.updateMaterialStatus(request, reply);
    },
  );

  app.put(
    '/admin/materials/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return contentController.adminUpdateMaterial(request, reply);
    },
  );

  app.delete(
    '/admin/materials/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return contentController.adminDeleteMaterial(request, reply);
    },
  );

  // POST /admin/materials —— 创建材质 (Admin context)
  app.post(
    '/admin/materials',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([
          { name: 'material', maxCount: 1 },
          { name: 'thumbnail', maxCount: 1 },
        ]),
      ],
    },
    async (request, reply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const adminUserId = (request as any).userId as string;

        let authorUserId = adminUserId;
        if (body.userId && typeof body.userId === 'string' && body.userId.trim()) {
          const userExists = await prisma.user.findUnique({ where: { id: body.userId } });
          if (userExists) authorUserId = body.userId;
        }

        const title = (body.title as string | undefined)?.trim() || 'Untitled Material';
        const category = (body.category as string | undefined)?.trim() || 'Other';

        const files = (request as unknown as { files?: Record<string, UploadedFile[]> }).files;
        const materialFile = files?.material?.[0];
        const thumbnailFile = files?.thumbnail?.[0];
        const externalUrl = body.externalUrl as string | undefined;

        let url = externalUrl || '';
        let size = 0;

        if (materialFile) {
          url = materialFile.url || '';
          size = parseFloat((materialFile.size / (1024 * 1024)).toFixed(2));
        }

        let thumbnailUrl = null;
        if (thumbnailFile) {
          thumbnailUrl = thumbnailFile.url || '';
        } else if (body.externalThumbnailUrl && typeof body.externalThumbnailUrl === 'string') {
          thumbnailUrl = body.externalThumbnailUrl;
        }

        let parsedTags = null;
        if (body.tags && typeof body.tags === 'string') {
          const tagsArr = body.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          parsedTags = tagsArr.length > 0 ? JSON.stringify(tagsArr) : null;
        }

        const status = (body.status as string) === 'PENDING' ? 'PENDING' : 'APPROVED';
        const material = await prisma.material.create({
          data: {
            title,
            description: body.description as string | undefined,
            fileUrl: url,
            previewUrl: thumbnailUrl,
            fileSize: size,
            category,
            resolution: (body.resolution as string) || '2K',
            isProcedural:
              body.isProcedural !== undefined ? String(body.isProcedural) === 'true' : false,
            status,
            userId: authorUserId,
            tags: parsedTags,
            originality: (body.originality as string) || 'ORIGINAL',
            originalAuthor: body.originalAuthor as string | undefined,
            originalLink: body.originalLink as string | undefined,
            license: (body.license as string) || 'CC_BY',
          },
        });
        await auditService.log({
          userId: adminUserId,
          action: AuditAction.CREATE_MATERIAL,
          module: AuditModule.MATERIAL,
          description: `Admin created material on behalf of ${authorUserId}: ${material.title}`,
          newValue: material,
          req: request as any,
        });

        reply.send(material);
      } catch (error) {
        logger.error('[Fastify admin] createMaterial error:', error);
        throw error;
      }
    },
  );

  // ===== Showcase audit =====
  app.get('/admin/showcases', { ...auth }, async (request, reply) => {
    return contentController.getAllShowcasesForAdmin(request, reply);
  });

  app.put('/admin/showcases/batch-status', { ...auth }, async (request, reply) => {
    return contentController.batchUpdateShowcaseStatus(request, reply);
  });

  app.put(
    '/admin/showcases/:id/status',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return contentController.updateShowcaseStatus(request, reply);
    },
  );

  app.put(
    '/admin/showcases/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return contentController.adminUpdateShowcase(request, reply);
    },
  );

  app.delete(
    '/admin/showcases/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return contentController.adminDeleteShowcase(request, reply);
    },
  );

  // POST /admin/showcases —— 创建作品展示 (Admin context)
  app.post(
    '/admin/showcases',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([
          { name: 'showcase', maxCount: 1 },
          { name: 'thumbnail', maxCount: 1 },
        ]),
      ],
    },
    async (request, reply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const adminUserId = (request as any).userId as string;

        let authorUserId = adminUserId;
        if (body.userId && typeof body.userId === 'string' && body.userId.trim()) {
          const userExists = await prisma.user.findUnique({ where: { id: body.userId } });
          if (userExists) authorUserId = body.userId;
        }

        const title = (body.title as string | undefined)?.trim() || 'Untitled Showcase';
        const type = (body.type as string) || 'IMAGE'; // IMAGE or VIDEO

        const files = (request as unknown as { files?: Record<string, UploadedFile[]> }).files;
        const mainFile = files?.showcase?.[0];
        const thumbnailFile = files?.thumbnail?.[0];
        const externalUrl = body.externalUrl as string | undefined;

        let url = externalUrl || '';
        if (mainFile) {
          url = mainFile.url || '';
        }

        let thumbnailUrl = null;
        if (thumbnailFile) {
          thumbnailUrl = thumbnailFile.url || '';
        } else if (body.externalThumbnailUrl && typeof body.externalThumbnailUrl === 'string') {
          thumbnailUrl = body.externalThumbnailUrl;
        }

        let parsedTags = null;
        if (body.tags && typeof body.tags === 'string') {
          const tagsArr = body.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          parsedTags = tagsArr.length > 0 ? JSON.stringify(tagsArr) : null;
        }

        const status = (body.status as string) === 'PENDING' ? 'PENDING' : 'APPROVED';

        const showcase = await prisma.showcase.create({
          data: {
            title,
            description: body.description as string | undefined,
            tags: parsedTags,
            type,
            thumbnailUrl: thumbnailUrl || '',
            videoUrl: type === 'VIDEO' ? url : null,
            isVideo: type === 'VIDEO',
            userId: authorUserId,
            status,
          },
        });

        await auditService.log({
          userId: adminUserId,
          action: AuditAction.CREATE_SHOWCASE,
          module: AuditModule.SHOWCASE,
          description: `Admin created showcase on behalf of ${authorUserId}: ${showcase.title}`,
          newValue: showcase,
          req: request as any,
        });

        reply.send(showcase);
      } catch (error) {
        logger.error('[Fastify admin] createShowcase error:', error);
        throw error;
      }
    },
  );

  // ===== Assets management =====
  app.get('/admin/assets', { ...auth }, async (request, reply) => {
    return assetController.getAllAssetsForAdmin(request, reply);
  });

  app.put('/admin/assets/batch-status', { ...auth }, async (request, reply) => {
    return assetController.batchUpdateAssetStatus(request, reply);
  });

  app.put(
    '/admin/assets/:id/status',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return assetController.updateAssetStatus(request, reply);
    },
  );

  app.put(
    '/admin/assets/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return assetController.adminUpdateAsset(request, reply);
    },
  );

  app.delete(
    '/admin/assets/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return assetController.adminDeleteAsset(request, reply);
    },
  );

  // POST /admin/assets —— 创建资产 (Admin context)
  app.post(
    '/admin/assets',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([
          { name: 'asset', maxCount: 1 },
          { name: 'thumbnail', maxCount: 1 },
          { name: 'package', maxCount: 1 },
        ]),
      ],
    },
    async (request, reply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const adminUserId = (request as any).userId as string;

        let authorUserId = adminUserId;
        if (body.userId && typeof body.userId === 'string' && body.userId.trim()) {
          const userExists = await prisma.user.findUnique({ where: { id: body.userId } });
          if (userExists) {
            authorUserId = body.userId;
          }
        }

        const title = (body.title as string | undefined)?.trim() || 'Untitled Asset';
        const categoryId = body.categoryId as string | undefined;
        if (!categoryId) {
          throw new AppError('Category is required', 400);
        }

        const files = (request as unknown as { files?: Record<string, UploadedFile[]> }).files;
        const assetFile = files?.asset?.[0];
        const packageFile = files?.package?.[0];
        const thumbnailFile = files?.thumbnail?.[0];
        const externalUrl = body.externalUrl as string | undefined;

        let url = externalUrl || '';
        let type = 'LINK';
        let size = 0;

        if (assetFile) {
          url = assetFile.url || '';
          type = 'GLB';
          size = parseFloat((assetFile.size / (1024 * 1024)).toFixed(2));
        }

        let packageUrl = null;
        let packageSize = null;
        let packageFilesList: string[] = [];

        if (packageFile) {
          packageUrl = packageFile.url || '';
          packageSize = parseFloat((packageFile.size / (1024 * 1024)).toFixed(2));
        }

        let thumbnailUrl = null;
        if (thumbnailFile) {
          thumbnailUrl = thumbnailFile.url || '';
        } else if (body.externalThumbnailUrl && typeof body.externalThumbnailUrl === 'string') {
          thumbnailUrl = body.externalThumbnailUrl;
        }

        let parsedTags = null;
        if (body.tags && typeof body.tags === 'string') {
          const tagsArr = body.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          parsedTags = tagsArr.length > 0 ? JSON.stringify(tagsArr) : null;
        }

        const status = (body.status as string) === 'PENDING' ? 'PENDING' : 'APPROVED';

        const parseBool = (val: any, dflt: boolean) => {
          if (val === undefined || val === null) return dflt;
          return String(val) === 'true';
        };

        const asset = await prisma.asset.create({
          data: {
            title,
            description: body.description as string | undefined,
            url,
            packageUrl,
            packageSize,
            packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
            thumbnail: thumbnailUrl,
            type,
            size,
            categoryId,
            status,
            userId: authorUserId,
            isFree: parseBool(body.isFree, true),
            formats: body.formats ? JSON.stringify(body.formats) : null,
            tags: parsedTags,
            bilibiliUrl: body.bilibiliUrl as string | undefined,
            originality: (body.originality as string) || 'ORIGINAL',
            originalAuthor: body.originalAuthor as string | undefined,
            originalLink: body.originalLink as string | undefined,
            license: (body.license as string) || 'CC_BY',
            meshType: (body.meshType as string) || 'LOW_POLY',
            uvUnwrapped: parseBool(body.uvUnwrapped, true),
            uvOverlapping: parseBool(body.uvOverlapping, false),
            pbrChannels: body.pbrChannels ? JSON.stringify(body.pbrChannels) : null,
            rigged: parseBool(body.rigged, false),
            gameReady: parseBool(body.gameReady, false),
          },
          include: { category: true },
        });

        if (assetFile && assetFile.buffer) {
          try {
            await QueueService.enqueue(
              'draco-compression',
              {
                assetId: asset.id,
                buffer: assetFile.buffer.toString('base64'),
                ext: path.extname(assetFile.originalname).toLowerCase() || '.glb',
                file: assetFile,
              },
              {
                idempotencyKey: `upload:${authorUserId}:${title}:${Date.now()}`,
                type: 'draco-compression',
                userId: authorUserId,
              },
            );
          } catch (enqueueErr) {
            logger.error('[AdminAssetCreate] Queue enqueue error:', enqueueErr);
          }
        }

        await auditService.log({
          userId: adminUserId,
          action: AuditAction.CREATE_ASSET,
          module: AuditModule.ASSET,
          description: `Admin created asset on behalf of ${authorUserId}: ${asset.title}`,
          newValue: asset,
          req: request as unknown as AuditRequest,
        });

        reply.send(asset);
      } catch (error) {
        logger.error('[Fastify admin] createAsset error:', error);
        throw error;
      }
    },
  );

  // ===== Subscriptions =====
  app.get('/admin/subscription-plans', { ...auth }, async (request, reply) => {
    return subscriptionController.getAllSubscriptionPlans(request, reply);
  });

  app.post('/admin/subscription-plans', { ...auth }, async (request, reply) => {
    return subscriptionController.createSubscriptionPlan(request, reply);
  });

  app.put(
    '/admin/subscription-plans/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return subscriptionController.updateSubscriptionPlan(request, reply);
    },
  );

  app.delete(
    '/admin/subscription-plans/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return subscriptionController.deleteSubscriptionPlan(request, reply);
    },
  );

  app.get('/admin/subscriptions', { ...auth }, async (request, reply) => {
    return subscriptionController.getAllSubscriptions(request, reply);
  });

  app.post('/admin/subscriptions', { ...auth }, async (request, reply) => {
    return subscriptionController.createSubscription(request, reply);
  });

  app.put(
    '/admin/subscriptions/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return subscriptionController.updateSubscription(request, reply);
    },
  );

  app.delete(
    '/admin/subscriptions/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return subscriptionController.deleteSubscription(request, reply);
    },
  );

  app.get('/admin/transactions', { ...auth }, async (request, reply) => {
    return subscriptionController.getAllTransactions(request, reply);
  });

  // ===== Activation codes =====
  app.get('/admin/activation-codes', { ...auth }, async (request, reply) => {
    return activationCodeController.getAllActivationCodes(request, reply);
  });

  app.post('/admin/activation-codes', { ...auth }, async (request, reply) => {
    return activationCodeController.createActivationCode(request, reply);
  });

  app.delete(
    '/admin/activation-codes/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return activationCodeController.deleteActivationCode(request, reply);
    },
  );

  // ===== Banners (admin CRUD) =====
  app.get('/admin/banners', { ...auth }, async (request, reply) => {
    return bannerController.getAllBanners(request, reply);
  });

  app.post('/admin/banners', { ...auth }, async (request, reply) => {
    return bannerController.createBanner(request, reply);
  });

  app.put(
    '/admin/banners/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return bannerController.updateBanner(request, reply);
    },
  );

  app.delete(
    '/admin/banners/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return bannerController.deleteBanner(request, reply);
    },
  );

  app.post(
    '/admin/banners/upload',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([{ name: 'banner_image', maxCount: 1 }]),
      ],
    },
    async (request, reply) => {
      return bannerController.uploadBannerImage(request, reply);
    },
  );

  // ===== Storage configs =====
  app.get('/admin/storage-configs', { ...auth }, async (request, reply) => {
    return storageController.getConfigs(request, reply);
  });

  app.get('/admin/storage-configs/export', { ...auth }, async (request, reply) => {
    return storageController.exportConfigs(request, reply);
  });

  app.post('/admin/storage-configs/import', { ...auth }, async (request, reply) => {
    return storageController.importConfigs(request, reply);
  });

  app.post('/admin/storage-configs', { ...auth }, async (request, reply) => {
    return storageController.createConfig(request, reply);
  });

  app.put(
    '/admin/storage-configs/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return storageController.updateConfig(request, reply);
    },
  );

  app.delete(
    '/admin/storage-configs/:id',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return storageController.deleteConfig(request, reply);
    },
  );

  app.post('/admin/storage-configs/test', { ...auth }, async (request, reply) => {
    return storageController.testConfig(request, reply);
  });

  app.get(
    '/admin/storage-configs/:id/reveal-secrets',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return storageController.revealConfigSecrets(request, reply);
    },
  );

  app.get(
    '/admin/storage-configs/:id/files',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return storageController.listBucketFiles(request, reply);
    },
  );

  app.patch(
    '/admin/storage-configs/:id/files/rename',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return storageController.renameBucketFile(request, reply);
    },
  );

  app.post(
    '/admin/storage-configs/:id/files/bulk-delete',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return storageController.deleteBucketFilesBulk(request, reply);
    },
  );

  app.delete(
    '/admin/storage-configs/:id/files',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return storageController.deleteBucketFile(request, reply);
    },
  );

  app.post(
    '/admin/storage-configs/:id/files',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([{ name: 'file', maxCount: 1 }]),
      ],
      schema: { params: idParams },
    },
    async (request, reply) => {
      return storageController.uploadDirectFile(request, reply);
    },
  );

  app.get(
    '/admin/storage-configs/:id/actual-size',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return storageController.getActualSize(request, reply);
    },
  );

  app.post('/admin/storage-configs/sync-all-sizes', { ...auth }, async (request, reply) => {
    return storageController.syncAllActualSizes(request, reply);
  });

  app.post(
    '/admin/storage-configs/:id/sync-size',
    { ...auth, schema: { params: idParams } },
    async (request, reply) => {
      return storageController.syncActualSize(request, reply);
    },
  );

  // ===== Cloudflare =====
  app.get('/admin/cloudflare/config', { ...auth }, async (request, reply) => {
    return cloudflareController.getConfig(request, reply);
  });

  app.get('/admin/cloudflare/config/reveal-secrets', { ...auth }, async (request, reply) => {
    return cloudflareController.revealConfigSecrets(request, reply);
  });

  app.put('/admin/cloudflare/config', { ...auth }, async (request, reply) => {
    return cloudflareController.saveConfig(request, reply);
  });

  app.delete('/admin/cloudflare/config', { ...auth }, async (request, reply) => {
    return cloudflareController.clearConfig(request, reply);
  });

  app.post('/admin/cloudflare/verify', { ...auth }, async (request, reply) => {
    return cloudflareController.verifyToken(request, reply);
  });

  app.get('/admin/cloudflare/zones', { ...auth }, async (request, reply) => {
    return cloudflareController.listZones(request, reply);
  });

  app.get(
    '/admin/cloudflare/zones/:zoneId',
    { ...auth, schema: { params: zoneIdParams } },
    async (request, reply) => {
      return cloudflareController.getZone(request, reply);
    },
  );

  app.get(
    '/admin/cloudflare/zones/:zoneId/settings',
    { ...auth, schema: { params: zoneIdParams } },
    async (request, reply) => {
      return cloudflareController.getZoneSettings(request, reply);
    },
  );

  app.patch(
    '/admin/cloudflare/zones/:zoneId/pause',
    { ...auth, schema: { params: zoneIdParams } },
    async (request, reply) => {
      return cloudflareController.updateZonePause(request, reply);
    },
  );

  app.get(
    '/admin/cloudflare/zones/:zoneId/dns',
    { ...auth, schema: { params: zoneIdParams } },
    async (request, reply) => {
      return cloudflareController.listDnsRecords(request, reply);
    },
  );

  app.post(
    '/admin/cloudflare/zones/:zoneId/dns',
    { ...auth, schema: { params: zoneIdParams } },
    async (request, reply) => {
      return cloudflareController.createDnsRecord(request, reply);
    },
  );

  app.patch(
    '/admin/cloudflare/zones/:zoneId/dns/:recordId',
    { ...auth, schema: { params: zoneIdRecordIdParams } },
    async (request, reply) => {
      return cloudflareController.updateDnsRecord(request, reply);
    },
  );

  app.delete(
    '/admin/cloudflare/zones/:zoneId/dns/:recordId',
    { ...auth, schema: { params: zoneIdRecordIdParams } },
    async (request, reply) => {
      return cloudflareController.deleteDnsRecord(request, reply);
    },
  );
};
