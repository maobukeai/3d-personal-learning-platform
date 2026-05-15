import { Router } from 'express';
import * as teamController from '../controllers/team.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';
import { sanitizeInput, validate } from '../middlewares/validation.middleware';

const router = Router();

router.use(authenticate);

// Static routes MUST come before param routes (/:teamId)
router.get('/', teamController.getTeams);
router.get('/public', teamController.getPublicTeams);
router.post('/', teamController.createTeam);

// Invitation routes
router.get('/invitations/my', teamController.getMyInvitations);
router.post('/invitations/respond', teamController.respondToInvitation);
router.delete('/invitations/:invitationId', teamController.cancelInvitation);
router.post('/invite', teamController.inviteToTeam);

// Application routes (apply to join a team)
router.post('/apply', teamController.applyToTeam);
router.post('/applications/respond', teamController.respondToApplication);

// Direct member management
router.post('/members', teamController.addMemberDirectly);

// Param routes last
router.get('/:teamId', teamController.getTeamById);
router.patch('/:teamId', teamController.updateTeam);
router.post(
  '/:teamId/upload-avatar',
  upload.single('avatar'),
  validateFileContent,
  teamController.uploadTeamAvatar,
);
router.delete('/:teamId', sanitizeInput, teamController.deleteTeam);
router.get('/:teamId/members', teamController.getTeamMembers);
router.delete('/:teamId/members/:userId', teamController.removeMember);
router.patch('/:teamId/members/:userId/role', teamController.updateMemberRole);

export default router;
