import { Router } from 'express';
import { alipayWebhook } from '../controllers/webhook.controller';

const router = Router();

// Handle Alipay async notification
router.post('/alipay', alipayWebhook);

export default router;
