import { Router } from 'express';
import * as resourceController from '../controllers/resource.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/feed', resourceController.getResourceFeed);
router.get('/my-workbench', resourceController.getMyResourceWorkbench);
router.get('/overview', resourceController.getResourceOverview);

export default router;
