import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import * as mirrorController from '../controllers/mirror.controller';

const router = Router();

// Rate limiter for extracting resource download links to prevent crawler scripting
const extractLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/sources', optionalAuthenticate, mirrorController.getSources);
router.get('/sources/:id', optionalAuthenticate, mirrorController.getSource);
router.get('/sources/:sourceId/categories', optionalAuthenticate, mirrorController.getCategories);
router.get('/sources/:sourceId/resources', optionalAuthenticate, mirrorController.getResources);
router.get('/sources/:sourceId/stats', optionalAuthenticate, mirrorController.getSourceStats);
router.get('/sources/:sourceId/search', optionalAuthenticate, mirrorController.searchResources);
router.get('/sources/:sourceId/plan-required', mirrorController.getPlanRequiredForSource);

// Publicly readable resource details & interactions (checked in controller for download link access)
router.get('/resources/:id', optionalAuthenticate, mirrorController.getResource);
router.get('/resources/:id/comments', optionalAuthenticate, mirrorController.getResourceComments);
router.get('/resources/:id/like-status', optionalAuthenticate, mirrorController.getResourceLikeStatus);

// Encrypted, rate-limited and authorization-checked resource download link extraction
router.post('/resources/:id/extract', authenticate, extractLimiter, mirrorController.extractResourceLink);

// Mutating actions require authenticated user
router.post('/resources/:id/comments', authenticate, mirrorController.createResourceComment);
router.delete(
  '/resources/comments/:commentId',
  authenticate,
  mirrorController.deleteResourceComment,
);
router.post('/resources/:id/like', authenticate, mirrorController.toggleResourceLike);

export default router;
