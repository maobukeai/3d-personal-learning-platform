import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Protect all routes with auth middleware
router.use(authenticate);

// Account management
router.post('/accounts/import', EmailController.importAccounts);
router.get('/accounts', EmailController.getAccounts);
router.delete('/accounts/:id', EmailController.deleteAccount);
router.post('/accounts/:id/test', EmailController.testAccount);

// Folder & message syncing
router.get('/accounts/:id/folders', EmailController.getFolders);
router.get('/accounts/:id/messages', EmailController.getMessages);
router.patch('/accounts/:id/messages/:messageId', EmailController.markMessageRead);
router.delete('/accounts/:id/messages/:messageId', EmailController.deleteMessage);

// Safe Email Sending
router.post('/send', EmailController.sendEmail);

export default router;
