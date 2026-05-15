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
};

if (!config.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Prisma will use the default from schema.prisma');
}
