import { Router } from 'express';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';
import * as adminPluginController from '../controllers/admin/plugin.admin.controller';

const router = Router();

router.use(authenticate, isAdmin);

router.get('/plugins', adminPluginController.adminListPlugins);
router.put('/plugins/batch-status', adminPluginController.adminBatchUpdatePlugins);
router.put('/plugins/:id/status', adminPluginController.adminUpdatePlugin);
router.put('/plugins/:id', adminPluginController.adminUpdatePlugin);
router.delete('/plugins/:id', adminPluginController.adminDeletePlugin);

export default router;
