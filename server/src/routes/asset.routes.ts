import { Router } from 'express';
import * as assetController from '../controllers/asset.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

import * as categoryController from '../controllers/category.controller';
router.get('/categories', categoryController.getAllCategories);

router.post('/upload', upload.fields([{ name: 'asset', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), validateFileContent, assetController.uploadAsset);
router.get('/my', assetController.getUserAssets);
router.get('/public', assetController.getPublicAssets);
router.get('/:id', assetController.getAssetById);
router.patch('/:id', assetController.updateAsset);
router.patch('/:id/metadata', assetController.updateAssetMetadata);
router.patch('/:id/thumbnail', assetController.updateAssetThumbnail);
router.delete('/:id', assetController.deleteAsset);

export default router;
