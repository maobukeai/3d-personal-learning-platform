import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware';
import rateLimit from 'express-rate-limit';
import { createRateLimitHandler } from '../middlewares/rate-limit.middleware';

const router = Router();

// Rate limiter for resource-heavy AI endpoints to prevent abuse and API cost exploitation
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('AI 接口请求过于频繁，请稍后再试。', 'AI_RATE_LIMITED'),
  keyGenerator: (req) => {
    const authReq = req as any;
    return authReq.userId ? `ai_user_${authReq.userId}` : `ai_ip_${req.ip}`;
  },
});

// AI chat is publicly accessible (guests can use the assistant without logging in)
router.post('/ai-chat', optionalAuthenticate, aiRateLimiter, projectController.aiChat);

router.use(authenticate);



router.get('/', projectController.getAllProjects);
router.post('/', projectController.createProject);
router.post('/import', projectController.importProjectFromText);
router.post('/ai-generate', aiRateLimiter, projectController.aiGenerateProjectText);
router.post('/parse-netdisk', aiRateLimiter, projectController.parseNetdiskLink);
router.post('/co-plan-chat', aiRateLimiter, projectController.coPlanChatStream);
router.post('/import-json', projectController.importProjectFromJson);
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
