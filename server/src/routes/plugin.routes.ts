import { Router } from 'express';
import * as pluginController from '../controllers/plugin.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

// Public routes
router.get('/', pluginController.listPlugins);

// Authenticated routes
router.use(authenticate);
router.get('/my', pluginController.getMyPlugins);
router.post(
  '/upload',
  upload.fields([
    { name: 'plugin_file', maxCount: 1 },
    { name: 'plugin_preview', maxCount: 1 },
  ]),
  validateFileContent,
  pluginController.uploadPlugin,
);
router.put('/:id', pluginController.updatePlugin);
router.delete('/:id', pluginController.deletePlugin);
router.post('/:id/download', pluginController.downloadPlugin);

export default router;
