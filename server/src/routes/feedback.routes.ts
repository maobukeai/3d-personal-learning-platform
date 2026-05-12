import { Router } from 'express';
import * as feedbackController from '../controllers/feedback.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('file'), validateFileContent, feedbackController.uploadAttachment);
router.post('/', feedbackController.submitFeedback);
router.get('/my', feedbackController.getMyFeedback);

export default router;
