import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

export const config = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET: (() => {
    const secret = process.env.JWT_SECRET;
    if (
      !secret ||
      secret === 'dev-secret-key-do-not-use-in-production-1234567890' ||
      secret === 'dev-secret-key-change-in-production'
    ) {
      if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: A secure JWT_SECRET environment variable must be set in production!');
        process.exit(1);
      }
      // In development, generate a cryptographically secure key at startup
      return crypto.randomBytes(32).toString('hex');
    }
    return secret;
  })(),
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`,
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
