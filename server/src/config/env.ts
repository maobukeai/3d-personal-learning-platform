import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

export const config = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET:
    process.env.JWT_SECRET ||
    (() => {
      if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: JWT_SECRET environment variable must be set in production!');
        process.exit(1);
      }
      return crypto.randomBytes(64).toString('hex');
    })(),
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',
  ALIPAY: {
    APP_ID: process.env.ALIPAY_APP_ID,
    PRIVATE_KEY: process.env.ALIPAY_PRIVATE_KEY,
    PUBLIC_KEY: process.env.ALIPAY_PUBLIC_KEY,
    GATEWAY: process.env.ALIPAY_GATEWAY || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
  },
};

if (!config.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Prisma will use the default from schema.prisma');
}
