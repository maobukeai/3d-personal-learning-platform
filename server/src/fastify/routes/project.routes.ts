import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  fastifyAuthenticate,
  fastifyOptionalAuthenticate,
  fastifyResolveWorkspace,
} from '../auth/fastify-auth';
import * as projectController from '../../controllers/project.controller';
import * as projectAiController from '../../controllers/project-ai.controller';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';
import {
  aiChatSchema,
  aiGenerateProjectTextSchema,
  addDiscussionReactionSchema,
  addProjectDiscussionSchema,
  batchCreateProjectTasksSchema,
  cleanAiMessagesSchema,
  coPlanChatSchema,
  createProjectSchema,
  createProjectTaskSchema,
  importProjectFromJsonSchema,
  importProjectFromTextSchema,
  inviteToProjectSchema,
  parseNetdiskLinkSchema,
  removeProjectMemberSchema,
  summarizeAiChatSessionSchema,
  updateAiChatSessionSchema,
  updateProjectSchema,
  updateProjectTaskSchema,
} from '../../utils/schemas-batch1';

/**
 * Fastify 项目路由（原生 handler 模式）。
 *
 * project.controller.ts / project-ai.controller.ts 已重写为原生 Fastify handler，
 * 路由直接传递 controller 函数。
 *
 * 挂载前缀: /api/projects
 *
 * 文件上传端点（使用 @fastify/multipart / fastifyUpload 中间件）：
 *  - POST /ai-chat/upload
 *  - POST /discussion-image-uploads
 *  - POST /discussion-file-uploads
 *
 * 流式端点（SSE）：
 *  - POST /co-plan-chat 由 controller 内部 reply.hijack() 接管原始响应
 *
 * 路由级限流：AI 端点对齐 Express aiRateLimiter (10/min)。
 * Express 的 authenticate 会顺带解析 workspaceId，Fastify 这里用 fastifyResolveWorkspace 复刻。
 */

// 鉴权 + 工作空间解析（对齐 Express authenticate 的完整行为）
const authWithWorkspace = [fastifyAuthenticate, fastifyResolveWorkspace];
const optionalAuthWithWorkspace = [fastifyOptionalAuthenticate, fastifyResolveWorkspace];

// 开发环境 AI 聊天允许游客访问，生产环境强制鉴权
const publicAiPreHandler =
  process.env.NODE_ENV === 'production' ? authWithWorkspace : optionalAuthWithWorkspace;

// --- Params schemas ---

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const runIdParamsSchema = z.object({
  runId: z.string().min(1),
});

const sessionIdParamsSchema = z.object({
  sessionId: z.string().min(1),
});

const invitationIdParamsSchema = z.object({
  invitationId: z.string().min(1),
});

const discussionIdParamsSchema = z.object({
  discussionId: z.string().min(1),
});

const taskIdParamsSchema = z.object({
  taskId: z.string().min(1),
});

// AI 端点限流：对齐 Express aiRateLimiter (10/min)
const AI_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

export const registerProjectRoutes = (app: FastifyInstance): void => {
  // ── 公开 AI 聊天（开发游客可访问，生产需鉴权）──────────────────────

  app.post(
    '/projects/ai-chat',
    {
      preHandler: publicAiPreHandler,
      schema: { body: aiChatSchema },
      config: { rateLimit: AI_RATE_LIMIT },
    },
    projectAiController.aiChat,
  );

  app.post(
    '/projects/ai-chat/upload',
    {
      preHandler: [...publicAiPreHandler, fastifyUpload([{ name: 'image', maxCount: 1 }])],
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    projectAiController.uploadAiChatImage,
  );

  // ── 鉴权 AI 端点 ─────────────────────────────────────────────────────

  app.get(
    '/projects/ai-chat/usage',
    { preHandler: authWithWorkspace },
    projectAiController.getAiUsage,
  );

  app.post(
    '/projects/ai-chat/runs/:runId/stop',
    {
      preHandler: authWithWorkspace,
      schema: { params: runIdParamsSchema },
    },
    projectAiController.stopAiChatRun,
  );

  app.get(
    '/projects/ai-chat/runs/:runId/status',
    {
      preHandler: authWithWorkspace,
      schema: { params: runIdParamsSchema },
    },
    projectAiController.getAiChatRunStatus,
  );

  app.get(
    '/projects/ai-chat/sessions',
    { preHandler: authWithWorkspace },
    projectAiController.getAiChatSessions,
  );

  app.patch(
    '/projects/ai-chat/sessions/:sessionId',
    {
      preHandler: authWithWorkspace,
      schema: { params: sessionIdParamsSchema, body: updateAiChatSessionSchema },
    },
    projectAiController.updateAiChatSession,
  );

  app.post(
    '/projects/ai-chat/sessions/:sessionId/summary',
    {
      preHandler: authWithWorkspace,
      schema: { params: sessionIdParamsSchema, body: summarizeAiChatSessionSchema },
    },
    projectAiController.summarizeAiChatSession,
  );

  app.get(
    '/projects/ai-chat/history',
    { preHandler: authWithWorkspace },
    projectAiController.getAiChatHistory,
  );

  app.delete(
    '/projects/ai-chat/history',
    { preHandler: authWithWorkspace },
    projectAiController.clearAiChatHistory,
  );

  app.post(
    '/projects/ai-chat/messages/clean',
    {
      preHandler: authWithWorkspace,
      schema: { body: cleanAiMessagesSchema },
    },
    projectAiController.cleanAiMessages,
  );

  // ── 项目 CRUD（公开读，鉴权写）──────────────────────────────────────

  app.get('/projects', { preHandler: optionalAuthWithWorkspace }, projectController.getAllProjects);

  app.get(
    '/projects/:id',
    {
      preHandler: optionalAuthWithWorkspace,
      schema: { params: idParamsSchema },
    },
    projectController.getProjectById,
  );

  app.post(
    '/projects',
    {
      preHandler: authWithWorkspace,
      schema: { body: createProjectSchema },
    },
    projectController.createProject,
  );

  app.post(
    '/projects/import',
    {
      preHandler: authWithWorkspace,
      schema: { body: importProjectFromTextSchema },
    },
    projectController.importProjectFromText,
  );

  app.post(
    '/projects/ai-generate',
    {
      preHandler: authWithWorkspace,
      schema: { body: aiGenerateProjectTextSchema },
      config: { rateLimit: AI_RATE_LIMIT },
    },
    projectAiController.aiGenerateProjectText,
  );

  app.post(
    '/projects/parse-netdisk',
    {
      preHandler: authWithWorkspace,
      schema: { body: parseNetdiskLinkSchema },
      config: { rateLimit: AI_RATE_LIMIT },
    },
    projectAiController.parseNetdiskLink,
  );

  // POST /projects/co-plan-chat —— SSE 流式响应（controller 内部 reply.hijack）
  app.post(
    '/projects/co-plan-chat',
    {
      preHandler: authWithWorkspace,
      schema: { body: coPlanChatSchema },
      config: { rateLimit: AI_RATE_LIMIT },
    },
    projectAiController.coPlanChatStream,
  );

  app.post(
    '/projects/import-json',
    {
      preHandler: authWithWorkspace,
      schema: { body: importProjectFromJsonSchema },
    },
    projectAiController.importProjectFromJson,
  );

  app.put(
    '/projects/:id',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, body: updateProjectSchema },
    },
    projectController.updateProject,
  );

  app.delete(
    '/projects/:id',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    projectController.deleteProject,
  );

  // ── 成员 / 邀请 ──────────────────────────────────────────────────────

  app.post(
    '/projects/:id/join',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    projectController.joinProject,
  );

  app.post(
    '/projects/:id/invite',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, body: inviteToProjectSchema },
    },
    projectController.inviteToProject,
  );

  app.post(
    '/projects/:id/members/remove',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, body: removeProjectMemberSchema },
    },
    projectController.removeProjectMember,
  );

  app.post(
    '/projects/invitations/:invitationId/accept',
    {
      preHandler: authWithWorkspace,
      schema: { params: invitationIdParamsSchema },
    },
    projectController.acceptProjectInvitation,
  );

  app.post(
    '/projects/invitations/:invitationId/reject',
    {
      preHandler: authWithWorkspace,
      schema: { params: invitationIdParamsSchema },
    },
    projectController.rejectProjectInvitation,
  );

  // ── 讨论 / 任务 ──────────────────────────────────────────────────────

  app.post(
    '/projects/:id/discussions',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, body: addProjectDiscussionSchema },
    },
    projectController.addDiscussion,
  );

  app.post(
    '/projects/discussions/:discussionId/reactions',
    {
      preHandler: authWithWorkspace,
      schema: { params: discussionIdParamsSchema, body: addDiscussionReactionSchema },
    },
    projectController.addDiscussionReaction,
  );

  app.delete(
    '/projects/discussions/:discussionId',
    {
      preHandler: authWithWorkspace,
      schema: { params: discussionIdParamsSchema },
    },
    projectController.deleteDiscussion,
  );

  app.post(
    '/projects/discussion-image-uploads',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyResolveWorkspace,
        fastifyUpload([{ name: 'images', maxCount: 1 }]),
      ],
    },
    projectController.uploadDiscussionAttachment,
  );

  app.post(
    '/projects/discussion-file-uploads',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyResolveWorkspace,
        fastifyUpload([{ name: 'message_file', maxCount: 1 }]),
      ],
    },
    projectController.uploadDiscussionAttachment,
  );

  app.post(
    '/projects/:id/tasks',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, body: createProjectTaskSchema },
    },
    projectController.createProjectTask,
  );

  app.post(
    '/projects/:id/tasks/batch',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, body: batchCreateProjectTasksSchema },
    },
    projectController.batchCreateProjectTasks,
  );

  app.put(
    '/projects/tasks/:taskId',
    {
      preHandler: authWithWorkspace,
      schema: { params: taskIdParamsSchema, body: updateProjectTaskSchema },
    },
    projectController.updateProjectTask,
  );
};
