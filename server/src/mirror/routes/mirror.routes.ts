import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import * as mirrorController from '../controllers/mirror.controller';

const router = Router();

router.get('/sources', optionalAuthenticate, mirrorController.getSources);
router.get('/sources/:id', optionalAuthenticate, mirrorController.getSource);
router.get('/sources/:sourceId/categories', optionalAuthenticate, mirrorController.getCategories);
router.get('/sources/:sourceId/resources', optionalAuthenticate, mirrorController.getResources);
router.get('/sources/:sourceId/stats', optionalAuthenticate, mirrorController.getSourceStats);
router.get('/sources/:sourceId/search', optionalAuthenticate, mirrorController.searchResources);
router.get('/sources/:sourceId/plan-required', mirrorController.getPlanRequiredForSource);
router.get('/resources/:id', authenticate, mirrorController.getResource);
router.get('/resources/:id/comments', authenticate, mirrorController.getResourceComments);
router.post('/resources/:id/comments', authenticate, mirrorController.createResourceComment);
router.delete(
  '/resources/comments/:commentId',
  authenticate,
  mirrorController.deleteResourceComment,
);
router.post('/resources/:id/like', authenticate, mirrorController.toggleResourceLike);
router.get('/resources/:id/like-status', authenticate, mirrorController.getResourceLikeStatus);

export default router;
