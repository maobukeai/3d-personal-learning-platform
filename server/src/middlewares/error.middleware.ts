import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

const handlePrismaError = (err: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (err.code) {
    case 'P2002':
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      return new AppError(`数据冲突：${target} 已存在`, 409);
    case 'P2025':
      return new AppError('请求的资源不存在', 404);
    case 'P2003':
      return new AppError('关联数据不存在', 400);
    case 'P2011':
      return new AppError('缺少必填字段', 400);
    case 'P2012':
      return new AppError('缺少必填值', 400);
    case 'P2014':
      return new AppError('操作被拒绝，因为关联数据仍然存在', 400);
    case 'P2015':
      return new AppError('关联记录不存在', 404);
    case 'P2016':
      return new AppError('查询解释错误', 400);
    case 'P2021':
      return new AppError('请求的表不存在', 404);
    default:
      return new AppError(`数据库错误 (${err.code})`, 500);
  }
};

const handleJWTError = (err: Error): AppError => {
  if (err.name === 'JsonWebTokenError') {
    return new AppError('无效的认证令牌', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return new AppError('认证令牌已过期', 401);
  }
  if (err.name === 'NotBeforeError') {
    return new AppError('认证令牌尚未生效', 401);
  }
  return new AppError('认证失败', 401);
};

const handleMulterError = (err: any): AppError => {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError('文件大小超出限制', 400);
    case 'LIMIT_FILE_COUNT':
      return new AppError('文件数量超出限制', 400);
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError('意外的文件字段', 400);
    default:
      return new AppError('文件上传失败', 400);
  }
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let error = err;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    error = new AppError('数据验证失败', 400);
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    error = new AppError('未知的数据库请求错误', 500);
  } else if (
    err.name === 'JsonWebTokenError' ||
    err.name === 'TokenExpiredError' ||
    err.name === 'NotBeforeError'
  ) {
    error = handleJWTError(err);
  } else if (err.name === 'MulterError') {
    error = handleMulterError(err);
  } else if (err.name === 'SyntaxError' && (err as any).status === 400 && 'body' in err) {
    error = new AppError('请求体格式错误：无效的 JSON', 400);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  if (statusCode === 500) {
    try {
      const logMsg = `\n\n[${new Date().toISOString()}] ${req.method} ${req.url}\nError: ${message}\nStack: ${err?.stack || err}\n`;
      fs.appendFileSync(path.join(__dirname, '../../error-debug.log'), logMsg);
    } catch (e) {
      console.error('Failed to write debug log:', e);
    }
  }

  console.error(`[Error] ${req.method} ${req.url} [${statusCode}]:`, message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    status: 'error',
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
