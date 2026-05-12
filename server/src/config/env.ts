import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key-that-should-be-very-long-and-secure-for-dev',
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',
};

if (config.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'fallback-secret-key-that-should-be-very-long-and-secure-for-dev')) {
  console.error('FATAL: A secure JWT_SECRET must be set in production!');
  process.exit(1);
}

if (!config.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Prisma will use the default from schema.prisma');
}
