import nodemailer from 'nodemailer';
import prisma from '../services/prisma';

export const sendEmail = async (to: string, subject: string, text: string, html: string) => {
  // Fetch SMTP settings from DB
  const settings = await prisma.systemSetting.findMany();
  const config = settings.reduce((acc: any, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});

  if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: parseInt(config.SMTP_PORT) || 465,
      secure: config.SMTP_SECURE !== 'false',
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      },
      connectionTimeout: 20000,
      socketTimeout: 20000,
    });

    try {
      await transporter.sendMail({
        from: config.SMTP_FROM || config.SMTP_USER,
        to,
        subject,
        text,
        html,
      });
      console.log(`[Email Success] To: ${to}`);
      return true;
    } catch (error) {
      console.error(`[Email Error] To: ${to}`, error);
      return false;
    }
  } else {
    console.log(`[Email Mock/Not Configured] To: ${to}, Subject: ${subject}`);
    return true; // Assume success for mock/development
  }
};
