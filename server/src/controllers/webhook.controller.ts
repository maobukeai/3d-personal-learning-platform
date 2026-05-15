import { Request, Response } from 'express';
import { verifyAlipaySign } from '../services/alipay';
import { paymentService } from '../services/payment.service';
import prisma from '../services/prisma';

export const alipayWebhook = async (req: Request, res: Response) => {
  const postData = req.body;
  console.log('Received Alipay webhook:', postData);

  try {
    const isValid = verifyAlipaySign(postData);
    if (!isValid) {
      console.warn('Alipay signature verification failed');
      return res.status(400).send('fail');
    }

    const tradeStatus = postData.trade_status;
    const invoiceNo = postData.out_trade_no;
    const tradeNo = postData.trade_no;

    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      const transaction = await prisma.transaction.findFirst({
        where: { invoiceNo },
      });

      if (transaction && transaction.status === 'PENDING') {
        await paymentService.verifyPayment(transaction.id, tradeNo);
        console.log(`Transaction ${transaction.id} processed successfully via webhook`);
      }
    }

    res.send('success');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('fail');
  }
};
