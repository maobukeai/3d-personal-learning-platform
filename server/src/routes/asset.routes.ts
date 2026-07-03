import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import * as assetController from '../controllers/asset.controller';
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
  validate: false,
  handler: createRateLimitHandler('上传请求过于频繁，请稍后再试。', 'UPLOAD_RATE_LIMITED'),
  keyGenerator: (req) => (req as RequestWithUserId).userId || req.ip || 'unknown',
});

// Dedicated limiter for download endpoints (bandwidth + DB writes).
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: createRateLimitHandler('下载请求过于频繁，请稍后再试。', 'DOWNLOAD_RATE_LIMITED'),
  keyGenerator: (req) => (req as RequestWithUserId).userId || req.ip || 'unknown',
});

router.get('/share/:shareId', assetController.getPublicSharedAsset);

router.use(authenticate);

import * as categoryController from '../controllers/category.controller';
router.get('/categories', categoryController.getAllCategories);

router.post(
  '/upload',
  uploadLimiter,
  upload.fields([
    { name: 'asset', maxCount: 1 },
    { name: 'package', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  validateFileContent,
  assetController.uploadAsset,
);
router.get('/my', assetController.getUserAssets);
router.get('/public', assetController.getPublicAssets);
router.get('/favorites', assetController.getMyFavoriteAssets);
router.post('/favorites/categories', assetController.createAssetFavoriteCategory);
router.put('/favorites/categories', assetController.updateAssetFavoriteCategory);
router.delete('/favorites/categories/:categoryName', assetController.deleteAssetFavoriteCategory);
router.get('/insights', assetController.getAssetInsights);
router.get('/tags', assetController.getAssetTags);

// Asset Help Requests endpoints
router.get('/requests', assetController.listAssetRequests);
router.get('/requests/:id', assetController.getAssetRequestById);
router.post('/requests', assetController.createAssetRequest);
router.post('/requests/:id/replies', assetController.createAssetRequestReply);
router.post('/requests/:id/resolve', assetController.resolveAssetRequest);

router.post('/:id/download', downloadLimiter, assetController.recordAssetDownload);
router.post('/:id/like', assetController.toggleAssetLike);
router.get('/:id/toolkit', assetController.getAssetToolkit);
router.get('/:id/package-files', assetController.getAssetPackageFiles);
router.get('/:id', assetController.getAssetById);
router.patch(
  '/:id',
  uploadLimiter,
  upload.fields([
    { name: 'asset', maxCount: 1 },
    { name: 'package', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  validateFileContent,
  assetController.updateAsset,
);
router.patch('/:id/metadata', assetController.updateAssetMetadata);
router.patch('/:id/thumbnail', uploadLimiter, assetController.updateAssetThumbnail);
router.delete('/:id', assetController.deleteAsset);
router.post('/bulk-delete', assetController.bulkDeleteAssets);
router.post('/bulk/favorite', assetController.bulkFavoriteAssets);

// Versions and 3D Annotations
router.post(
  '/:id/versions',
  uploadLimiter,
  upload.fields([
    { name: 'asset', maxCount: 1 },
    { name: 'package', maxCount: 1 },
  ]),
  validateFileContent,
  assetController.uploadAssetVersion,
);
router.get('/:id/versions', assetController.getAssetVersions);
router.post('/:id/annotations', assetController.createAssetAnnotation);
router.get('/:id/annotations', assetController.getAssetAnnotations);
router.delete('/:id/annotations/:annotationId', assetController.deleteAssetAnnotation);

// Asset sharing configuration
router.get('/:id/share', assetController.getAssetShare);
router.post('/:id/share', assetController.createOrUpdateAssetShare);
router.delete('/:id/share', assetController.cancelAssetShare);

// Comments endpoints
router.get('/:id/comments', assetController.getAssetComments);
router.post('/:id/comments', assetController.createAssetComment);
router.delete('/comments/:commentId', assetController.deleteAssetComment);

export default router;
