import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import * as manualController from '../controllers/manual-station.controller';

const router = Router();

const extractLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // Limit each IP to 15 requests per minute
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/stations', optionalAuthenticate, manualController.getStations);
router.get('/stations/:id', optionalAuthenticate, manualController.getStation);
router.get('/stations/:stationId/categories', optionalAuthenticate, manualController.getCategories);
router.get('/stations/:stationId/resources', optionalAuthenticate, manualController.getResources);

router.get('/resources/:id', optionalAuthenticate, manualController.getResource);
router.post(
  '/resources/:id/extract',
  authenticate,
  extractLimiter,
  manualController.extractDownloadLink,
);
router.post('/resources/:id/comments', authenticate, manualController.createComment);
router.post('/resources/:id/like', authenticate, manualController.toggleLike);

export default router;
