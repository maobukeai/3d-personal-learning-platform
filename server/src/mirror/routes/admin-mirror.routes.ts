import { Router } from 'express';
import { authenticate, isAdmin } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/upload.middleware';
import * as adminMirrorController from '../controllers/admin-mirror.controller';

const router = Router();

router.use(authenticate);
router.use(isAdmin);

router.get('/sources', adminMirrorController.getAllSources);
router.post('/sources', adminMirrorController.createSource);
router.get('/sources/:id', adminMirrorController.getSourceDetail);
router.put('/sources/:id', adminMirrorController.updateSource);
router.delete('/sources/:id', adminMirrorController.deleteSource);

router.post('/sources/:id/sync', adminMirrorController.triggerSync);
router.post('/sources/:id/sync/cancel', adminMirrorController.cancelSync);
router.get('/sources/:id/sync-status', adminMirrorController.getSyncStatus);
router.get('/sources/:id/sync-logs', adminMirrorController.getSyncLogs);
router.post('/sources/:id/match-links', upload.single('file'), adminMirrorController.matchLinks);

export default router;
