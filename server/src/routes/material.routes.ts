import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import * as materialController from '../controllers/material.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { createRateLimitHandler } from '../middlewares/rate-limit.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

type RequestWithUserId = Request & { userId?: string };

const router = Router();

// Dedicated limiter for upload endpoints (CPU/storage heavy).
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('上传请求过于频繁，请稍后再试。', 'UPLOAD_RATE_LIMITED'),
  keyGenerator: (req) => (req as RequestWithUserId).userId || req.ip || 'unknown',
});

// Dedicated limiter for download endpoints (bandwidth + DB writes).
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('下载请求过于频繁，请稍后再试。', 'DOWNLOAD_RATE_LIMITED'),
  keyGenerator: (req) => (req as RequestWithUserId).userId || req.ip || 'unknown',
});

router.get('/share/:shareId', materialController.getPublicSharedMaterial);

router.use(authenticate);

router.get('/', materialController.getAllMaterials);
router.get('/insights', materialController.getMaterialInsights);
router.get('/favorites', materialController.getMyFavorites);
router.post('/favorites/categories', materialController.createMaterialFavoriteCategory);
router.put('/favorites/categories', materialController.updateMaterialFavoriteCategory);
router.delete(
  '/favorites/categories/:categoryName',
  materialController.deleteMaterialFavoriteCategory,
);
router.get('/my', materialController.getMyMaterials);
router.post('/bulk/favorite', materialController.bulkFavoriteMaterials);
router.get('/:id/file', downloadLimiter, materialController.downloadMaterial);
router.get('/:id', materialController.getMaterialById);
router.get('/:id/package-files', materialController.getMaterialPackageFiles);
router.get('/:id/zip-entry', downloadLimiter, materialController.getMaterialZipEntry);
router.post(
  '/upload',
  uploadLimiter,
  upload.fields([
    { name: 'material', maxCount: 1 },
    { name: 'preview', maxCount: 1 },
  ]),
  validateFileContent,
  materialController.uploadMaterial,
);
router.put(
  '/:id',
  uploadLimiter,
  upload.fields([
    { name: 'material', maxCount: 1 },
    { name: 'preview', maxCount: 1 },
  ]),
  validateFileContent,
  materialController.updateMaterial,
);
router.patch('/:id/status', materialController.reviewMaterial);
router.delete('/:id', materialController.deleteMaterial);
router.post('/:id/download', downloadLimiter, materialController.recordDownload);
router.post('/:id/favorite', materialController.toggleFavorite);

// Comments endpoints
router.get('/:id/comments', materialController.getMaterialComments);
router.post('/:id/comments', materialController.createMaterialComment);
router.delete('/comments/:commentId', materialController.deleteMaterialComment);

// Sharing endpoints
router.get('/:id/share', materialController.getMaterialShare);
router.post('/:id/share', materialController.createOrUpdateMaterialShare);
router.delete('/:id/share', materialController.cancelMaterialShare);

export default router;
