import { Router } from 'express';
import * as roadmapController from '../controllers/roadmap.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', roadmapController.getAllRoadmaps);
router.get('/my-progress', roadmapController.getMyRoadmapProgress);
router.post('/step-progress', roadmapController.updateStepProgress);

router.post('/', roadmapController.createRoadmap);
router.put('/:id', roadmapController.updateRoadmap);
router.delete('/:id', roadmapController.deleteRoadmap);

export default router;
