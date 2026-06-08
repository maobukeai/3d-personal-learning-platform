import { Router } from 'express';
import * as assetController from '../controllers/asset.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

import * as categoryController from '../controllers/category.controller';
router.get('/categories', categoryController.getAllCategories);

router.post(
  '/upload',
  upload.fields([
    { name: 'asset', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  validateFileContent,
  assetController.uploadAsset,
);
router.get('/my', assetController.getUserAssets);
router.get('/public', assetController.getPublicAssets);
router.get('/tags', assetController.getAssetTags);
router.post('/:id/download', assetController.recordAssetDownload);
router.post('/:id/like', assetController.toggleAssetLike);
router.get('/:id', assetController.getAssetById);
router.patch('/:id', assetController.updateAsset);
router.patch('/:id/metadata', assetController.updateAssetMetadata);
router.patch('/:id/thumbnail', assetController.updateAssetThumbnail);
router.delete('/:id', assetController.deleteAsset);

// Versions and 3D Annotations
router.post(
  '/:id/versions',
  upload.fields([{ name: 'asset', maxCount: 1 }]),
  validateFileContent,
  assetController.uploadAssetVersion,
);
router.get('/:id/versions', assetController.getAssetVersions);
router.post('/:id/annotations', assetController.createAssetAnnotation);
router.get('/:id/annotations', assetController.getAssetAnnotations);
router.delete('/:id/annotations/:annotationId', assetController.deleteAssetAnnotation);

export default router;
