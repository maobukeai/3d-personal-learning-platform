import { Router } from 'express';
import * as pluginController from '../controllers/plugin.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.get('/share/:shareId', pluginController.getPublicSharedPlugin);

// Public Client / Integration endpoints (non-authenticated)
router.get('/client/check-update', pluginController.checkPluginUpdate);
router.post('/client/feedback', pluginController.createPluginFeedback);

// Public Help Requests
router.get('/requests', pluginController.listPluginRequests);
router.get('/requests/:id', pluginController.getPluginRequestById);

// Authenticated routes
router.use(authenticate);
router.get('/', pluginController.listPlugins);
router.get('/insights', pluginController.getPluginInsights);
router.get('/favorites', pluginController.getMyFavoritePlugins);
router.post('/favorites/categories', pluginController.createFavoriteCategory);
router.put('/favorites/categories', pluginController.updateFavoriteCategory);
router.delete('/favorites/categories/:categoryName', pluginController.deleteFavoriteCategory);
router.get('/my', pluginController.getMyPlugins);
router.get('/:id', pluginController.getPluginById);
router.get('/:id/package-files', pluginController.getPluginPackageFiles);
router.post(
  '/upload',
  upload.fields([
    { name: 'plugin_file', maxCount: 1 },
    { name: 'plugin_preview', maxCount: 1 },
  ]),
  validateFileContent,
  pluginController.uploadPlugin,
);
router.put(
  '/:id',
  upload.fields([
    { name: 'plugin_file', maxCount: 1 },
    { name: 'plugin_preview', maxCount: 1 },
  ]),
  validateFileContent,
  pluginController.updatePlugin,
);
router.delete('/:id', pluginController.deletePlugin);
router.post('/:id/download', pluginController.downloadPlugin);
router.post('/:id/favorite', pluginController.togglePluginFavorite);

// Comments endpoints
router.get('/:id/comments', pluginController.getPluginComments);
router.post('/:id/comments', pluginController.createPluginComment);
router.delete('/comments/:commentId', pluginController.deletePluginComment);

// Sharing endpoints
router.get('/:id/share', pluginController.getPluginShare);
router.post('/:id/share', pluginController.createOrUpdatePluginShare);
router.delete('/:id/share', pluginController.cancelPluginShare);

// Developer Token Management & Telemetry
router.post('/:id/token', pluginController.generateDeveloperToken);
router.get('/:id/feedbacks', pluginController.listPluginFeedbacks);

// Versions Control
router.post(
  '/:id/versions',
  upload.fields([{ name: 'plugin_file', maxCount: 1 }]),
  validateFileContent,
  pluginController.uploadPluginVersion,
);
router.get('/:id/versions', pluginController.listPluginVersions);
router.post('/:id/versions/:versionId/set-active', pluginController.setActivePluginVersion);

// Authenticated Help Requests
router.post('/requests', pluginController.createPluginRequest);
router.post('/requests/:id/replies', pluginController.createPluginRequestReply);
router.post('/requests/:id/resolve', pluginController.resolvePluginRequest);

export default router;
