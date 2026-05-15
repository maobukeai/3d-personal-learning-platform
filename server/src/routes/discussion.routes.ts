import { Router } from 'express';
import * as discussionController from '../controllers/discussion.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.get('/', authenticate, discussionController.getAllDiscussions);
router.get('/tags', authenticate, discussionController.getDiscussionTags);
router.get('/:id', authenticate, discussionController.getDiscussionById);
router.post(
  '/',
  authenticate,
  upload.array('images', 5),
  validateFileContent,
  discussionController.createDiscussion,
);
router.delete('/:id', authenticate, discussionController.deleteDiscussion);
router.post('/:id/like', authenticate, discussionController.toggleLikeDiscussion);
router.post('/:id/pin', authenticate, discussionController.togglePinDiscussion);
router.post('/comments', authenticate, discussionController.addComment);
router.delete('/comments/:id', authenticate, discussionController.deleteComment);
router.post('/comments/:id/like', authenticate, discussionController.toggleLikeComment);

export default router;
