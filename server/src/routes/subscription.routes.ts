import { Router } from 'express';
import * as subscriptionController from '../controllers/subscription.controller';
import { redeemActivationCode } from '../controllers/activationCode.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/plans', subscriptionController.getPlans);
router.post('/redeem', redeemActivationCode);
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
