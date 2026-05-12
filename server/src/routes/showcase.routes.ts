import { Router } from 'express';
import * as showcaseController from '../controllers/showcase.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/', showcaseController.getAllShowcases);
router.get('/my', showcaseController.getMyShowcases);
router.get('/:id', showcaseController.getShowcaseById);
router.post('/',
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 9 }
  ]),
  validateFileContent,
  showcaseController.createShowcase
);
router.post('/publish-asset', showcaseController.publishAssetToShowcase);
router.put('/:id',
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 9 }
  ]),
  validateFileContent,
  showcaseController.updateShowcase
);
router.delete('/:id', showcaseController.deleteShowcase);
router.post('/:id/like', showcaseController.toggleLike);
router.get('/:id/comments', showcaseController.getComments);
router.post('/:id/comment', showcaseController.addComment);
router.delete('/:id/comment/:commentId', showcaseController.deleteComment);

export default router;
