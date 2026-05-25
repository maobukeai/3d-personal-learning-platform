import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', projectController.getAllProjects);
router.post('/', projectController.createProject);
router.post('/import', projectController.importProjectFromText);
router.post('/ai-generate', projectController.aiGenerateProjectText);
router.post('/ai-chat', projectController.aiChat);
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
