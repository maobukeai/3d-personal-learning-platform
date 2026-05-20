import prisma from './prisma';
import crypto from 'crypto';

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  ALIPAY = 'ALIPAY',
  WECHAT = 'WECHAT',
  MOCK = 'MOCK',
}

interface CreateOrderParams {
  userId: string;
  amount: number;
  description: string;
  planId?: string;
  planName?: string;
  interval?: string;
  paymentMethod: PaymentMethod | string;
}

class PaymentService {
  async createOrder({
    userId,
    amount,
    description,
    planId,
    planName,
    interval,
    paymentMethod,
  }: CreateOrderParams) {
    throw new Error('Paid subscriptions are no longer supported. Please use an activation code.');
  }

  async verifyPayment(transactionId: string, paymentId: string) {
    throw new Error('Paid subscriptions are no longer supported. Please use an activation code.');
  }
}

export const paymentService = new PaymentService();
