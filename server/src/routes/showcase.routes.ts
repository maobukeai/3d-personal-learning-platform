import { Router } from 'express';
import * as showcaseController from '../controllers/showcase.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/', showcaseController.getAllShowcases);
router.post('/', 
  upload.fields([{ name: 'thumbnail', maxCount: 1 }]), 
  validateFileContent, 
  showcaseController.createShowcase
);
router.post('/:id/like', showcaseController.toggleLike);
router.post('/:id/comment', showcaseController.addComment);

export default router;
