import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

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
    '/api/auth/reset-password',
    '/api/auth/oauth/google',
    '/api/auth/oauth/google/callback',
    '/api/auth/oauth/github',
    '/api/auth/oauth/github/callback',
    '/api/auth/email/send-code-public',
    '/api/auth/email/verify-public',
    '/api/auth/refresh',
    '/api/auth/logout',
  ];

  const requestPath = req.originalUrl.split('?')[0] || req.originalUrl;
  if (bypassUrls.some(url => requestPath === url || requestPath.startsWith(url))) {
    return next();
  }

  // Double Submit Cookie verification
  const csrfCookie = req.cookies?.csrfToken;
  const csrfHeader = req.headers['x-csrf-token'];
  const csrfBody = req.body?._csrf;

  const csrfTokenFromRequest = csrfHeader || csrfBody;

  if (!csrfCookie || !csrfTokenFromRequest || csrfCookie !== csrfTokenFromRequest) {
    return next(new AppError('CSRF 校验失败', 403, 'CSRF_VALIDATION_FAILED'));
  }

  next();
};
