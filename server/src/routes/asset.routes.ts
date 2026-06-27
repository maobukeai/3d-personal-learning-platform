import { Router } from 'express';
import * as assetController from '../controllers/asset.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.get('/share/:shareId', assetController.getPublicSharedAsset);

router.use(authenticate);

import * as categoryController from '../controllers/category.controller';
router.get('/categories', categoryController.getAllCategories);

router.post(
  '/upload',
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
router.post('/:id/download', assetController.recordAssetDownload);
router.post('/:id/like', assetController.toggleAssetLike);
router.get('/:id/toolkit', assetController.getAssetToolkit);
router.get('/:id/package-files', assetController.getAssetPackageFiles);
router.get('/:id', assetController.getAssetById);
router.patch(
  '/:id',
  upload.fields([
    { name: 'asset', maxCount: 1 },
    { name: 'package', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  validateFileContent,
  assetController.updateAsset,
);
router.patch('/:id/metadata', assetController.updateAssetMetadata);
router.patch('/:id/thumbnail', assetController.updateAssetThumbnail);
router.delete('/:id', assetController.deleteAsset);

// Versions and 3D Annotations
router.post(
  '/:id/versions',
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
