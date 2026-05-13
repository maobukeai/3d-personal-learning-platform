import AlipaySdk from 'alipay-sdk';
import { config } from '../config/env';

// This acts as a wrapper around the alipay SDK.
// It uses sandbox configuration if proper keys are not set.

let alipaySdk: AlipaySdk | null = null;

try {
  alipaySdk = new AlipaySdk({
    appId: process.env.ALIPAY_APP_ID || '9021000122675661', // Sandbox App ID as fallback
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '', 
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    gateway: process.env.ALIPAY_GATEWAY || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
    timeout: 5000,
    camelcase: true
  });
} catch (error) {
  console.warn('Alipay SDK initialization failed. Payment gateway will not work.', error);
}

export const getAlipaySdk = () => alipaySdk;

export const generatePaymentUrl = (invoiceNo: string, amount: number, subject: string, returnUrl: string, notifyUrl: string) => {
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
    notifyUrl
  };

  return alipaySdk.pageExecute(method, 'GET', params);
};

export const verifyAlipaySign = (postData: any): boolean => {
  if (!alipaySdk) return false;
  return alipaySdk.checkNotifySign(postData);
};
