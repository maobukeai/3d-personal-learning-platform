import { logger } from '../utils/logger';
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { AppError } from '../utils/error';

export { AppError };

const handlePrismaError = (err: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (err.code) {
    case 'P2002': {
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      return new AppError(`数据冲突：${target} 已存在`, 409, 'DATABASE_CONFLICT', {
        target,
      });
    }
    case 'P2025':
      return new AppError('请求的资源不存在', 404, 'RESOURCE_NOT_FOUND');
    case 'P2003':
      return new AppError('关联数据不存在', 400, 'FOREIGN_KEY_CONSTRAINT');
    case 'P2011':
      return new AppError('缺少必填字段', 400, 'DATABASE_REQUIRED_FIELD');
    case 'P2012':
      return new AppError('缺少必填值', 400, 'DATABASE_REQUIRED_VALUE');
    case 'P2014':
      return new AppError('操作被拒绝，因为关联数据仍然存在', 400, 'RELATION_CONSTRAINT');
    case 'P2015':
      return new AppError('关联记录不存在', 404, 'RELATED_RECORD_NOT_FOUND');
    case 'P2016':
      return new AppError('查询解释错误', 400, 'DATABASE_QUERY_ERROR');
    case 'P2021':
      return new AppError('请求的表不存在', 404, 'DATABASE_TABLE_NOT_FOUND');
    default:
      return new AppError(`数据库错误 (${err.code})`, 500, 'DATABASE_ERROR');
  }
};

const handleJWTError = (err: Error): AppError => {
  if (err.name === 'JsonWebTokenError') {
    return new AppError('无效的认证令牌', 401, 'INVALID_TOKEN');
  }
  if (err.name === 'TokenExpiredError') {
    return new AppError('认证令牌已过期', 401, 'TOKEN_EXPIRED');
  }
  if (err.name === 'NotBeforeError') {
    return new AppError('认证令牌尚未生效', 401, 'TOKEN_NOT_ACTIVE');
  }
  return new AppError('认证失败', 401, 'AUTHENTICATION_FAILED');
};

interface MulterError extends Error {
  code?: string;
}
const handleMulterError = (err: MulterError): AppError => {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError('文件大小超出限制', 400, 'FILE_TOO_LARGE');
    case 'LIMIT_FILE_COUNT':
      return new AppError('文件数量超出限制', 400, 'TOO_MANY_FILES');
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError('意外的文件字段', 400, 'UNEXPECTED_FILE_FIELD');
    default:
      return new AppError('文件上传失败', 400, 'UPLOAD_FAILED');
  }
};

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let error: AppError | Error = err;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    error = new AppError('数据验证失败', 400, 'DATABASE_VALIDATION_ERROR');
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    error = new AppError('未知的数据库请求错误', 500, 'DATABASE_UNKNOWN_ERROR');
  } else if (
    err.name === 'JsonWebTokenError' ||
    err.name === 'TokenExpiredError' ||
    err.name === 'NotBeforeError'
  ) {
    error = handleJWTError(err);
  } else if (err.name === 'MulterError') {
    error = handleMulterError(err as MulterError);
  } else if (
    err.name === 'SyntaxError' &&
    (err as { status?: number }).status === 400 &&
    'body' in err
  ) {
    error = new AppError('请求体格式错误：无效的 JSON', 400, 'INVALID_JSON');
  } else if (err.message === 'Not allowed by CORS') {
    error = new AppError('当前来源不允许访问 API', 403, 'CORS_NOT_ALLOWED');
  }

  const appError = error instanceof AppError ? error : undefined;
  const statusCode =
    appError &&
    Number.isInteger(appError.statusCode) &&
    appError.statusCode >= 400 &&
    appError.statusCode < 600
      ? appError.statusCode
      : 500;
  const message = error.message || 'Internal Server Error';
  const code = appError?.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const requestId = (req as Request & { requestId?: string }).requestId;

  if (statusCode === 500) {
    try {
      const logPath = path.join(process.cwd(), 'error-debug.log');

      // Rotation logic: if file exceeds 10MB, back it up and start fresh
      try {
        if (fs.existsSync(logPath)) {
          const stats = fs.statSync(logPath);
          const maxBytes = 10 * 1024 * 1024; // 10MB
          if (stats.size > maxBytes) {
            const backupPath = path.join(process.cwd(), 'error-debug.old.log');
            if (fs.existsSync(backupPath)) {
              fs.unlinkSync(backupPath);
            }
            fs.renameSync(logPath, backupPath);
          }
        }
      } catch (rotationErr) {
        logger.error('Failed to rotate error-debug.log:', rotationErr);
      }

      const logMsg = `\n\n[${new Date().toISOString()}] ${req.method} ${req.url}${requestId ? ` requestId=${requestId}` : ''}\nError: ${message}\nStack: ${err?.stack || err}\n`;
      fs.appendFile(logPath, logMsg, (writeErr) => {
        if (writeErr) {
          logger.error('Failed to write debug log:', writeErr);
        }
      });
    } catch (e) {
      logger.error('Failed to write debug log:', e);
    }
  }

  logger.error(
    `[Error] ${req.method} ${req.url} [${statusCode}]${requestId ? ` [${requestId}]` : ''}:`,
    message,
  );
  if (process.env.NODE_ENV === 'development') {
    logger.error(err.stack ?? String(err));
  }

  res.status(statusCode).json({
    status: 'error',
    error: message,
    message,
    code,
    ...(requestId && { requestId }),
    ...(appError?.details !== undefined && { details: appError.details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
