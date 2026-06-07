import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import * as projectAiController from '../controllers/project-ai.controller';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware';
import rateLimit from 'express-rate-limit';
import { createRateLimitHandler } from '../middlewares/rate-limit.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';
import { createAiRateLimitKeyGenerator } from '../utils/ai-rate-limit';

const router = Router();
const publicAiMiddleware =
  process.env.NODE_ENV === 'production' ? authenticate : optionalAuthenticate;

// Rate limiter for resource-heavy AI endpoints to prevent abuse and API cost exploitation
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('AI 接口请求过于频繁，请稍后再试。', 'AI_RATE_LIMITED'),
  keyGenerator: createAiRateLimitKeyGenerator('ai_user', 'ai_ip'),
});

const aiUploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('AI 图片上传过于频繁，请稍后再试。', 'AI_UPLOAD_RATE_LIMITED'),
  keyGenerator: createAiRateLimitKeyGenerator('ai_upload_user', 'ai_upload_ip'),
});

// AI chat can be used by guests in development, but production requires auth to prevent API cost abuse.
router.post('/ai-chat', publicAiMiddleware, aiRateLimiter, projectAiController.aiChat);
router.post(
  '/ai-chat/upload',
  publicAiMiddleware,
  aiUploadRateLimiter,
  upload.single('image'),
  validateFileContent,
  projectAiController.uploadAiChatImage,
);

router.use(authenticate);

router.get('/ai-chat/usage', projectAiController.getAiUsage);
router.get('/ai-chat/history', projectAiController.getAiChatHistory);
router.delete('/ai-chat/history', projectAiController.clearAiChatHistory);

router.get('/', projectController.getAllProjects);
router.post('/', projectController.createProject);
router.post('/import', projectController.importProjectFromText);
router.post('/ai-generate', aiRateLimiter, projectAiController.aiGenerateProjectText);
router.post('/parse-netdisk', aiRateLimiter, projectAiController.parseNetdiskLink);
router.post('/co-plan-chat', aiRateLimiter, projectAiController.coPlanChatStream);
router.post('/import-json', projectAiController.importProjectFromJson);
router.get('/:id', projectController.getProjectById);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

router.post('/:id/join', projectController.joinProject);
router.post('/:id/invite', projectController.inviteToProject);
router.post('/:id/members/remove', projectController.removeProjectMember);
router.post('/invitations/:invitationId/accept', projectController.acceptProjectInvitation);
router.post('/invitations/:invitationId/reject', projectController.rejectProjectInvitation);
router.post('/:id/discussions', projectController.addDiscussion);
router.post('/discussions/:discussionId/reactions', projectController.addDiscussionReaction);
router.post('/:id/tasks', projectController.createProjectTask);
router.post('/:id/tasks/batch', projectController.batchCreateProjectTasks);
router.put('/tasks/:taskId', projectController.updateProjectTask);

export default router;
