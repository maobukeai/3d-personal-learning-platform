import { Router } from 'express';
import * as netdiskController from '../controllers/temporary-netdisk.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';
import rateLimit from 'express-rate-limit';
import { createRateLimitHandler } from '../middlewares/rate-limit.middleware';

const router = Router();

// rate limiters
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: createRateLimitHandler('上传请求过于频繁，请稍后再试。', 'UPLOAD_RATE_LIMITED'),
  keyGenerator: (req: any) => req.userId || req.ip || 'unknown',
});

// Public endpoints
router.get('/share/:shareId', netdiskController.getShareInfo);
router.post('/share/:shareId/verify', netdiskController.verifySharePassword);
router.get('/share/:shareId/download', netdiskController.downloadSharedFile);

// Authenticated endpoints
router.use(authenticate);
router.get('/files', netdiskController.getMyFiles);
router.post(
  '/upload',
  uploadLimiter,
  upload.single('temporary_file'),
  validateFileContent,
  netdiskController.uploadFile,
);
router.delete('/files/:id', netdiskController.deleteFile);
router.get('/files/:id/download', netdiskController.downloadFile);
router.post('/shares', netdiskController.createShare);

export default router;
