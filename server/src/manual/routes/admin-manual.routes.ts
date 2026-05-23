import { Router } from 'express';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware';
import * as manualController from '../controllers/manual-station.controller';
import { upload, validateFileContent } from '../../middlewares/upload.middleware';

const router = Router();

// Secure all admin manual station routes
router.use(authenticate, isAdmin);

// Image Upload
router.post(
  '/upload',
  upload.single('manual_image'),
  validateFileContent,
  manualController.uploadImage,
);

// Stations
router.post('/stations', manualController.createStation);
router.put('/stations/:id', manualController.updateStation);
router.delete('/stations/:id', manualController.deleteStation);

// Categories
router.post('/stations/:stationId/categories', manualController.createCategory);
router.put('/categories/:catId', manualController.updateCategory);
router.delete('/categories/:catId', manualController.deleteCategory);

// Resources
router.post('/stations/:stationId/resources', manualController.createResource);
router.put('/resources/:resId', manualController.updateResource);
router.delete('/resources/:resId', manualController.deleteResource);

export default router;
