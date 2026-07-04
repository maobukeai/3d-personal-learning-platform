import { Router } from 'express';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';
import * as adminSoftwareController from '../controllers/admin/software.admin.controller';

const router = Router();

router.use(authenticate, isAdmin);

router.get('/softwares', adminSoftwareController.adminListSoftwares);
router.put('/softwares/batch-status', adminSoftwareController.adminBatchUpdateSoftwares);
router.put('/softwares/:id/status', adminSoftwareController.adminUpdateSoftware);
router.put('/softwares/:id', adminSoftwareController.adminUpdateSoftware);
router.delete('/softwares/:id', adminSoftwareController.adminDeleteSoftware);

export default router;
