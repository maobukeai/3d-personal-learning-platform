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

/**
 * @deprecated Paid subscriptions are no longer supported. Please use an activation code instead.
 */
class PaymentService {
  async createOrder({
    userId: _userId,
    amount: _amount,
    description: _description,
    planId: _planId,
    planName: _planName,
    interval: _interval,
    paymentMethod: _paymentMethod,
  }: CreateOrderParams) {
    throw new Error('Paid subscriptions are no longer supported. Please use an activation code.');
  }

  async verifyPayment(_transactionId: string, _paymentId: string) {
    throw new Error('Paid subscriptions are no longer supported. Please use an activation code.');
  }
}

export const paymentService = new PaymentService();
