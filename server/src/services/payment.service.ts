import prisma from './prisma';
import crypto from 'crypto';
import { generatePaymentUrl } from './alipay';

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
    const invoiceNo = `INV-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount,
        description,
        planId,
        planName,
        interval,
        paymentMethod,
        invoiceNo,
        status: PaymentStatus.PENDING,
      },
    });

    let paymentUrl = null;
    if (paymentMethod === PaymentMethod.ALIPAY) {
      try {
        const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/checkout?success=true&orderId=${transaction.id}`;
        const notifyUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/webhooks/alipay`;
        paymentUrl = generatePaymentUrl(invoiceNo, amount, description, returnUrl, notifyUrl);
      } catch (error) {
        console.error('Failed to generate Alipay URL', error);
      }
    }

    return { transaction, paymentUrl };
  }

  async verifyPayment(transactionId: string, paymentId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: true },
    });

    if (!transaction || transaction.status !== PaymentStatus.PENDING) {
      throw new Error('Invalid or processed transaction');
    }

    // In a real integration, you would verify with the payment provider here
    // For MOCK, we just approve it
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: PaymentStatus.COMPLETED,
        paymentId,
      },
    });

    // Activate subscription
    if (transaction.planId && transaction.interval) {
      const durationDays = transaction.interval === 'YEARLY' ? 365 : 30;
      await prisma.subscription.upsert({
        where: { userId: transaction.userId },
        update: {
          planId: transaction.planId,
          status: 'ACTIVE',
          interval: transaction.interval,
          startDate: new Date(),
          endDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
          autoRenew: true,
          paymentMethod: transaction.paymentMethod,
        },
        create: {
          userId: transaction.userId,
          planId: transaction.planId,
          status: 'ACTIVE',
          interval: transaction.interval,
          startDate: new Date(),
          endDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
          autoRenew: true,
          paymentMethod: transaction.paymentMethod,
        },
      });
    }

    return updatedTransaction;
  }
}

export const paymentService = new PaymentService();
