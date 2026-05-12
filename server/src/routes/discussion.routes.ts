import { Router } from 'express';
import * as discussionController from '../controllers/discussion.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, discussionController.getAllDiscussions);
router.get('/:id', authenticate, discussionController.getDiscussionById);
router.post('/', authenticate, discussionController.createDiscussion);
router.post('/comments', authenticate, discussionController.addComment);

export default router;
