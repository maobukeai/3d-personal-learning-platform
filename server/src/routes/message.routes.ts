import { Router } from 'express';
import * as messageController from '../controllers/message.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/conversations', messageController.getConversations);
router.post('/conversations', messageController.createConversation);
router.patch('/conversations/:conversationId', messageController.updateConversation);
router.patch('/conversations/:conversationId/read', messageController.markAsRead);
router.post('/conversations/:conversationId/participants', messageController.addParticipant);
router.delete('/conversations/:conversationId/participants', messageController.removeParticipant);
router.post('/conversations/:conversationId/leave', messageController.leaveConversation);
router.delete('/conversations/:conversationId', messageController.deleteConversation);
router.get('/conversations/:conversationId/messages', messageController.getMessages);
router.post('/messages', messageController.sendMessage);
router.delete('/messages/:messageId', messageController.deleteMessage);
router.post('/upload', upload.single('message_file'), messageController.uploadFile);
router.post('/messages/:messageId/reactions', messageController.addReaction);
router.delete('/messages/:messageId/reactions/:emoji', messageController.removeReaction);
router.post('/translate', messageController.translateMessage);

export default router;
