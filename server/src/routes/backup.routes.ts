import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as backupController from '../controllers/backup.controller';

const router = Router();

// Secure all backup endpoints
router.use(authenticate);

router.get('/config', backupController.getBackupConfig);
router.post('/config', backupController.saveBackupConfig);
router.post('/test', backupController.testBackupConfig);
router.post('/run', backupController.runBackup);
router.get('/list', backupController.listBackups);
router.post('/restore', backupController.restoreBackup);
router.delete('/:filename', backupController.deleteBackup);

export default router;
