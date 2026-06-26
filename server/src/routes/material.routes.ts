import { Router } from 'express';
import * as materialController from '../controllers/material.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.get('/share/:shareId', materialController.getPublicSharedMaterial);

router.use(authenticate);

router.get('/', materialController.getAllMaterials);
router.get('/insights', materialController.getMaterialInsights);
router.get('/favorites', materialController.getMyFavorites);
router.get('/my', materialController.getMyMaterials);
router.post('/bulk/favorite', materialController.bulkFavoriteMaterials);
router.get('/:id/file', materialController.downloadMaterial);
router.get('/:id', materialController.getMaterialById);
router.get('/:id/package-files', materialController.getMaterialPackageFiles);
router.get('/:id/zip-entry', materialController.getMaterialZipEntry);
router.post(
  '/upload',
  upload.fields([
    { name: 'material', maxCount: 1 },
    { name: 'preview', maxCount: 1 },
  ]),
  validateFileContent,
  materialController.uploadMaterial,
);
router.put(
  '/:id',
  upload.fields([
    { name: 'material', maxCount: 1 },
    { name: 'preview', maxCount: 1 },
  ]),
  validateFileContent,
  materialController.updateMaterial,
);
router.patch('/:id/status', materialController.reviewMaterial);
router.delete('/:id', materialController.deleteMaterial);
router.post('/:id/download', materialController.recordDownload);
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
