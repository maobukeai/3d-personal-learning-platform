import { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import { AppError } from '../../utils/error';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

export const buildCorsOriginChecker = () => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.CORS_EXTRA_ORIGINS?.split(',').map((o) => o.trim()) ?? []),
  ].filter(Boolean) as string[];

  return async (origin: string | undefined): Promise<boolean> => {
    if (!origin) return true;
    if (
      allowedOrigins.indexOf(origin) !== -1 ||
      (process.env.NODE_ENV === 'development' &&
        (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')))
    ) {
      return true;
    }
    return false;
  };
};

export const registerAppHooks = (fapp: FastifyInstance) => {
  fapp.addHook('onRequest', async (request, reply) => {
    const header = request.headers['x-request-id'];
    const value = Array.isArray(header) ? header[0] : header;
    const requestId = value && REQUEST_ID_PATTERN.test(value) ? value : randomUUID();
    (request as FastifyRequest & { requestId?: string }).requestId = requestId;
    (request.raw as IncomingMessage & { requestId?: string }).requestId = requestId;
    reply.header('X-Request-Id', requestId);
  });

  fapp.addHook('preParsing', async (request, reply, payload) => {
    const requestPath = request.url.split('?')[0] || request.url;
    if (requestPath === '/api/assets/webhook') {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(chunk as Buffer);
      }
      const rawBody = Buffer.concat(chunks);
      (request as FastifyRequest & { rawBody?: Buffer }).rawBody = rawBody;
      const { Readable } = await import('stream');
      return Readable.from([rawBody]);
    }
    return payload;
  });
};

export const handlePrismaError = (err: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (err.code) {
    case 'P2002': {
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      return new AppError(`数据冲突：${target} 已存在`, 409, 'DATABASE_CONFLICT', { target });
    }
    case 'P2025':
      return new AppError('请求的记录不存在', 444, 'NOT_FOUND');
    case 'P2003':
      return new AppError('关联数据不存在，违反外键约束', 400, 'FOREIGN_KEY_VIOLATION');
    default:
      return new AppError(`数据库操作失败 [${err.code}]`, 500, 'DATABASE_ERROR');
  }
};
