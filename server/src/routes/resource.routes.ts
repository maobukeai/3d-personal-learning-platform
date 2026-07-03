import { Router } from 'express';
import * as resourceController from '../controllers/resource.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/feed', resourceController.getResourceFeed);
router.get('/my-workbench', resourceController.getMyResourceWorkbench);
router.get('/overview', resourceController.getResourceOverview);
router.get('/search-external', resourceController.searchExternal);
router.post('/import-external', resourceController.importExternalResource);

router.post('/upload-temp', upload.single('temp'), validateFileContent, resourceController.uploadTempFile);
router.post('/upload-temp-cancel', resourceController.cancelTempUpload);

export default router;
