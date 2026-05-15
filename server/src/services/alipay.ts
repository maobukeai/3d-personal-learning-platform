import { AlipaySdk } from 'alipay-sdk';
import { config } from '../config/env';

// This acts as a wrapper around the alipay SDK.
// It uses sandbox configuration if proper keys are not set.

let alipaySdk: AlipaySdk | null = null;
const { ALIPAY } = config;

if (ALIPAY.APP_ID && ALIPAY.PRIVATE_KEY) {
  try {
    alipaySdk = new AlipaySdk({
      appId: ALIPAY.APP_ID,
      privateKey: ALIPAY.PRIVATE_KEY,
      alipayPublicKey: ALIPAY.PUBLIC_KEY || '',
      gateway: ALIPAY.GATEWAY,
      timeout: 5000,
      camelcase: true,
    });
    console.log('Alipay SDK initialized successfully.');
  } catch (error) {
    console.warn('Alipay SDK initialization failed:', error);
  }
} else {
  console.log('Alipay SDK initialization skipped: Missing ALIPAY_APP_ID or ALIPAY_PRIVATE_KEY.');
}

export const getAlipaySdk = () => alipaySdk;

export const generatePaymentUrl = (
  invoiceNo: string,
  amount: number,
  subject: string,
  returnUrl: string,
  notifyUrl: string,
) => {
  if (!alipaySdk) {
    throw new Error('Alipay SDK is not initialized');
  }

  const method = 'alipay.trade.page.pay';
  const params = {
    method,
    bizContent: {
      outTradeNo: invoiceNo,
      productCode: 'FAST_INSTANT_TRADE_PAY',
      totalAmount: amount.toFixed(2),
      subject: subject,
    },
    returnUrl,
    notifyUrl,
  };

  return alipaySdk.pageExecute(method, 'GET', params as any);
};

export const verifyAlipaySign = (postData: any): boolean => {
  if (!alipaySdk) return false;
  return alipaySdk.checkNotifySign(postData);
};
