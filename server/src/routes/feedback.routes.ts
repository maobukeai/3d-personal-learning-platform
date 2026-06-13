import { Router } from 'express';
import * as feedbackController from '../controllers/feedback.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.post(
  '/upload',
  upload.single('file'),
  validateFileContent,
  feedbackController.uploadAttachment,
);
router.post('/', feedbackController.submitFeedback);
router.get('/stats', feedbackController.getMyFeedbackStats);
router.get('/my', feedbackController.getMyFeedback);
router.get('/:id', feedbackController.getMyFeedbackDetail);
router.put('/:id/status', feedbackController.updateMyFeedbackStatus);

export default router;
