import { Router } from 'express';
import * as teamController from '../controllers/team.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', teamController.getTeams);
router.post('/', teamController.createTeam);
router.get('/:teamId', teamController.getTeamById);
router.patch('/:teamId', teamController.updateTeam);
router.delete('/:teamId', teamController.deleteTeam);
router.get('/:teamId/members', teamController.getTeamMembers);
router.delete('/:teamId/members/:userId', teamController.removeMember);
router.patch('/:teamId/members/:userId/role', teamController.updateMemberRole);
router.post('/invite', teamController.inviteToTeam);
router.get('/invitations/my', teamController.getMyInvitations);
router.post('/invitations/respond', teamController.respondToInvitation);

export default router;
