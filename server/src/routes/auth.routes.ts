import { Router } from 'express';
import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';
import { sanitizeInput } from '../middlewares/validation.middleware';
import { validateRequest } from '../middlewares/zod-validation.middleware';
import { createRateLimitHandler } from '../middlewares/rate-limit.middleware';
import {
  registerSchema,
  sendCodePublicSchema,
  verifyPublicEmailSchema,
  loginSchema,
  login2FASchema,
  forgotPasswordCheckSchema,
  resetPasswordWith2FASchema,
  profileSchema,
  changePasswordSchema,
  verifyEmailSchema,
  sendCodeToNewEmailSchema,
  changeEmailSchema,
  enable2FASchema,
  deleteAccountSchema,
} from '../utils/schemas';

import {
  login,
  login2FA,
  refreshToken,
  logout,
  getPublicSettings,
  getMe,
} from '../controllers/auth/login.controller';

import {
  register,
  sendPublicVerificationCode,
  verifyPublicEmail,
} from '../controllers/auth/register.controller';

import {
  getPublicUsers,
  getUserProfile,
  getActivity,
  updateProfile,
  changePassword,
  sendVerificationCode,
  verifyEmail,
  sendCodeToNewEmail,
  changeEmail,
  uploadAvatar,
  getStats,
  getUserSettings,
  updateUserSettings,
  getTrustedDevices,
  revokeTrustedDevice,
  deleteAccount,
  forgotPasswordCheck,
  resetPasswordWith2FA,
} from '../controllers/auth/profile.controller';

import {
  setup2FA,
  getRecoveryCodes,
  regenerateRecoveryCodes,
  enable2FA,
  disable2FA,
} from '../controllers/auth/twoFactor.controller';

import {
  googleLogin,
  googleCallback,
  githubLogin,
  githubCallback,
} from '../controllers/auth/oauth.controller';

const router = Router();

const isDev = process.env.NODE_ENV === 'development';

const readPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getAuthAttemptKey = (req: Request) => {
  const body = req.body as {
    email?: unknown;
    tempUserId?: unknown;
    userId?: unknown;
  };

  const subject =
    typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : typeof body.tempUserId === 'string'
        ? body.tempUserId
        : typeof body.userId === 'string'
          ? body.userId
          : req.path;

  return `${ipKeyGenerator(req.ip || '')}:${subject}`;
};

const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : readPositiveInt(process.env.AUTH_IP_RATE_LIMIT_MAX, 200),
  handler: createRateLimitHandler('请求过于频繁，请稍后再试', 'AUTH_RATE_LIMITED'),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : readPositiveInt(process.env.AUTH_CREDENTIAL_RATE_LIMIT_MAX, 20),
  handler: createRateLimitHandler('请求过于频繁，请稍后再试', 'AUTH_RATE_LIMITED'),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: getAuthAttemptKey,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 1000 : 5,
  handler: createRateLimitHandler(
    '密码重置请求过于频繁，请 1 小时后再试',
    'PASSWORD_RESET_RATE_LIMITED',
  ),
  standardHeaders: true,
  legacyHeaders: false,
});

const emailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isDev ? 1000 : 10,
  handler: createRateLimitHandler('邮件发送请求过于频繁，请 10 分钟后再试', 'EMAIL_RATE_LIMITED'),
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/register',
  authIpLimiter,
  authLimiter,
  sanitizeInput,
  validateRequest({ body: registerSchema }),
  register,
);

router.post(
  '/email/send-code-public',
  emailLimiter,
  sanitizeInput,
  validateRequest({ body: sendCodePublicSchema }),
  sendPublicVerificationCode,
);

router.post(
  '/email/verify-public',
  sanitizeInput,
  validateRequest({ body: verifyPublicEmailSchema }),
  verifyPublicEmail,
);

router.post(
  '/login',
  authIpLimiter,
  authLimiter,
  sanitizeInput,
  validateRequest({ body: loginSchema }),
  login,
);

router.post('/refresh', refreshToken);
router.post('/logout', logout);

router.get('/settings', getPublicSettings);

router.post(
  '/login/2fa',
  authIpLimiter,
  authLimiter,
  sanitizeInput,
  validateRequest({ body: login2FASchema }),
  login2FA,
);

router.post(
  '/forgot-password/check',
  passwordResetLimiter,
  sanitizeInput,
  validateRequest({ body: forgotPasswordCheckSchema }),
  forgotPasswordCheck,
);

router.post(
  '/forgot-password/reset-2fa',
  passwordResetLimiter,
  sanitizeInput,
  validateRequest({ body: resetPasswordWith2FASchema }),
  resetPasswordWith2FA,
);

router.get('/me', authenticate, getMe);
router.get('/users/public', authenticate, getPublicUsers);
router.get('/users/:id', authenticate, getUserProfile);
router.get('/activity', authenticate, getActivity);

router.put(
  '/profile',
  authenticate,
  sanitizeInput,
  validateRequest({ body: profileSchema }),
  updateProfile,
);

router.put(
  '/change-password',
  authenticate,
  sanitizeInput,
  validateRequest({ body: changePasswordSchema }),
  changePassword,
);

router.post('/email/send-code', authenticate, emailLimiter, sendVerificationCode);
router.post(
  '/email/verify',
  authenticate,
  sanitizeInput,
  validateRequest({ body: verifyEmailSchema }),
  verifyEmail,
);

router.post(
  '/email/send-code-new',
  authenticate,
  emailLimiter,
  sanitizeInput,
  validateRequest({ body: sendCodeToNewEmailSchema }),
  sendCodeToNewEmail,
);

router.put(
  '/email/change',
  authenticate,
  sanitizeInput,
  validateRequest({ body: changeEmailSchema }),
  changeEmail,
);

router.put('/2fa/setup', authenticate, setup2FA);
router.get('/2fa/recovery-codes', authenticate, getRecoveryCodes);
router.post('/2fa/recovery-codes/regenerate', authenticate, regenerateRecoveryCodes);
router.post(
  '/2fa/enable',
  authenticate,
  sanitizeInput,
  validateRequest({ body: enable2FASchema }),
  enable2FA,
);
router.post('/2fa/disable', authenticate, disable2FA);

router.post(
  '/upload-avatar',
  authenticate,
  upload.single('avatar'),
  validateFileContent,
  uploadAvatar,
);
router.get('/stats', authenticate, getStats);

router.get('/user-settings', authenticate, getUserSettings);
router.post('/user-settings', authenticate, updateUserSettings);
router.get('/trusted-devices', authenticate, getTrustedDevices);
router.delete('/trusted-devices/:id', authenticate, revokeTrustedDevice);
router.delete(
  '/account',
  authenticate,
  sanitizeInput,
  validateRequest({ body: deleteAccountSchema }),
  deleteAccount,
);

router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);
router.get('/github', githubLogin);
router.get('/github/callback', githubCallback);

export default router;
