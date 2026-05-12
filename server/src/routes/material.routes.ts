import { Router } from 'express';
import * as materialController from '../controllers/material.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/', materialController.getAllMaterials);
router.get('/favorites', materialController.getMyFavorites);
router.get('/:id/file', materialController.downloadMaterial);
router.get('/:id', materialController.getMaterialById);
router.post('/upload', 
  upload.fields([{ name: 'material', maxCount: 1 }, { name: 'preview', maxCount: 1 }]), 
  validateFileContent, 
  materialController.uploadMaterial
);
router.delete('/:id', materialController.deleteMaterial);
router.post('/:id/download', materialController.recordDownload);
router.post('/:id/favorite', materialController.toggleFavorite);

export default router;
