import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as subscriptionController from '../controllers/subscription.controller';
import { redeemActivationCode } from '../controllers/activationCode.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

const redeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each user/IP to 5 redeem requests per 15 minutes
  message: { error: '兑换尝试过于频繁，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: any) => `${req.ip}_${req.userId || ''}`,
});

router.use(authenticate);

router.get('/plans', subscriptionController.getPlans);
router.post('/redeem', redeemLimiter, redeemActivationCode);
router.get('/me', subscriptionController.getMySubscription);
router.post('/subscribe', subscriptionController.subscribe);
router.post('/create-order', subscriptionController.createOrder);
router.post('/pay-order', subscriptionController.payOrder);
router.post('/verify-payment', subscriptionController.verifyPayment);
router.post('/cancel', subscriptionController.cancelSubscription);
router.post('/cancel-with-2fa', subscriptionController.cancelSubscriptionWith2FA);
router.get('/cancel-requires-2fa', subscriptionController.checkCancelRequires2FA);
router.post('/auto-renew', subscriptionController.toggleAutoRenew);
router.get('/transactions', subscriptionController.getTransactions);
router.get('/storage-usage', subscriptionController.getStorageUsage);
router.get('/limits', subscriptionController.getSubscriptionLimits);
router.get('/check', subscriptionController.checkSubscription);

export default router;
