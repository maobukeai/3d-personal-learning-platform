import type { FastifyInstance } from 'fastify';
import { fastifyAuthenticate } from '../auth/fastify-auth';
import * as subscriptionController from '../../controllers/subscription.controller';
import { redeemActivationCode } from '../../controllers/activationCode.controller';
import {
  cancelSubscriptionSchema,
  cancelSubscriptionWith2FASchema,
  redeemActivationCodeSchema,
  toggleAutoRenewSchema,
} from '../../utils/schemas-batch3';

/**
 * Fastify 订阅路由（原生 handler 模式）。
 *
 * subscription.controller.ts / activationCode.controller.ts 已重写为原生 Fastify handler，
 * 路由直接传递 controller 函数。
 *
 * 挂载前缀: /api/subscriptions
 *
 * 路由级限流：/subscriptions/redeem 对齐 Express redeemLimiter (5/15min)。
 */

// redeemLimiter: 5/15min（对齐 Express subscription.routes 内联限流）
const REDEEM_RATE_LIMIT = { max: 5, timeWindow: '15 minutes' };

const auth = { preHandler: [fastifyAuthenticate] };

export const registerSubscriptionRoutes = (app: FastifyInstance): void => {
  app.get('/subscriptions/plans', { ...auth }, subscriptionController.getPlans);

  app.post(
    '/subscriptions/redeem',
    {
      ...auth,
      schema: { body: redeemActivationCodeSchema },
      config: { rateLimit: REDEEM_RATE_LIMIT },
    },
    redeemActivationCode,
  );

  app.get('/subscriptions/me', { ...auth }, subscriptionController.getMySubscription);

  app.post('/subscriptions/subscribe', { ...auth }, subscriptionController.subscribe);

  app.post('/subscriptions/create-order', { ...auth }, subscriptionController.createOrder);

  app.post('/subscriptions/pay-order', { ...auth }, subscriptionController.payOrder);

  app.post('/subscriptions/verify-payment', { ...auth }, subscriptionController.verifyPayment);

  app.post(
    '/subscriptions/cancel',
    {
      ...auth,
      schema: { body: cancelSubscriptionSchema },
    },
    subscriptionController.cancelSubscription,
  );

  app.post(
    '/subscriptions/cancel-with-2fa',
    {
      ...auth,
      schema: { body: cancelSubscriptionWith2FASchema },
    },
    subscriptionController.cancelSubscriptionWith2FA,
  );

  app.get(
    '/subscriptions/cancel-requires-2fa',
    { ...auth },
    subscriptionController.checkCancelRequires2FA,
  );

  app.post(
    '/subscriptions/auto-renew',
    {
      ...auth,
      schema: { body: toggleAutoRenewSchema },
    },
    subscriptionController.toggleAutoRenew,
  );

  app.get('/subscriptions/transactions', { ...auth }, subscriptionController.getTransactions);

  app.get('/subscriptions/storage-usage', { ...auth }, subscriptionController.getStorageUsage);

  app.get('/subscriptions/limits', { ...auth }, subscriptionController.getSubscriptionLimits);

  app.get('/subscriptions/check', { ...auth }, subscriptionController.checkSubscription);
};
