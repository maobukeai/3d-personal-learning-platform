import { Router } from 'express';
import * as messageController from '../controllers/message.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/conversations', messageController.getConversations);
router.get('/conversations/:conversationId/messages', messageController.getMessages);
router.post('/conversations', messageController.createConversation);
router.post('/messages', messageController.sendMessage);
router.delete('/messages/:messageId', messageController.deleteMessage);
router.post('/upload', upload.single('message_file'), messageController.uploadFile);
router.patch('/conversations/:conversationId/read', messageController.markAsRead);

export default router;
