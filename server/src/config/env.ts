import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const dotenvCandidates = [
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
];

const dotenvPath = dotenvCandidates.find((candidate) => fs.existsSync(candidate));

if (dotenvPath) {
  dotenv.config({
    path: dotenvPath,
    override: !['production', 'test'].includes(process.env.NODE_ENV || ''),
  });
} else {
  dotenv.config();
}

/**
 * Parse a positive integer from an env string, falling back when missing/invalid.
 * Shared by app.ts and route files to avoid duplicate implementations.
 */
export const readPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  PORT: readPositiveInt(process.env.PORT, 3001),
  HOST: process.env.HOST?.trim() || '0.0.0.0',
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
      // In development, use a stable key so tokens survive server restarts.
      // Override via JWT_SECRET in .env or set a real key before deploying.
      return 'dev-stable-jwt-key-6f8a2b3c-d4e5-4f6a-7b8c-9d0e1f2a3b4c';
    }
    return secret;
  })(),
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL:
    process.env.BACKEND_URL || `http://localhost:${readPositiveInt(process.env.PORT, 3001)}`,
  // P4：R2 Event Notification Webhook HMAC 密钥 —— 缺失时 webhook 端点直接 throw（铁律：密钥不允许硬编码兜底）
  R2_WEBHOOK_SECRET: process.env.R2_WEBHOOK_SECRET || '',
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
