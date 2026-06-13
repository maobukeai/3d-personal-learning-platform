import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import crypto from 'crypto';

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const method = req.method;
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

  if (safeMethods.includes(method)) {
    return next();
  }

  // Whitelisted endpoints that bypass CSRF (mostly public/auth endpoints before a session/cookie is established)
  const bypassUrls = [
    '/api/auth/login',
    '/api/auth/login/2fa',
    '/api/auth/register',
    '/api/auth/register-admin',
    '/api/auth/forgot-password',
    '/api/auth/forgot-password/check',
    '/api/auth/forgot-password/reset-2fa',
    '/api/auth/reset-password',
    '/api/auth/oauth/google',
    '/api/auth/oauth/google/callback',
    '/api/auth/oauth/github',
    '/api/auth/oauth/github/callback',
    '/api/auth/email/send-code-public',
    '/api/auth/email/verify-public',
    '/api/auth/refresh',
    '/api/auth/logout',
    // Public AI assistant endpoints are protected by route-level rate limits.
    '/api/projects/ai-chat',
    '/api/projects/ai-chat/upload',
  ];

  const requestPath = req.originalUrl.split('?')[0] || req.originalUrl;
  const isSharedNoteAiSummarize = /^\/api\/notes\/share\/[^/]+\/ai-summarize$/.test(requestPath);
  const isAiBotCallback = /^\/api\/ai-bots\/callback\/[^/]+$/.test(requestPath);

  if (bypassUrls.includes(requestPath) || isSharedNoteAiSummarize || isAiBotCallback) {
    return next();
  }

  // Double Submit Cookie verification
  const csrfCookie = req.cookies?.csrfToken;
  const csrfHeader = req.headers['x-csrf-token'];
  const csrfBody = req.body?._csrf;

  const csrfTokenFromRequest = csrfHeader || csrfBody;

  const safeCompare = (a: string, b: string): boolean => {
    try {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      if (bufA.length !== bufB.length) {
        return false;
      }
      return crypto.timingSafeEqual(bufA, bufB);
    } catch (_e) {
      return false;
    }
  };

  if (
    !csrfCookie ||
    !csrfTokenFromRequest ||
    typeof csrfCookie !== 'string' ||
    typeof csrfTokenFromRequest !== 'string' ||
    !safeCompare(csrfCookie, csrfTokenFromRequest)
  ) {
    return next(new AppError('CSRF 校验失败', 403, 'CSRF_VALIDATION_FAILED'));
  }

  next();
};
