import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fastifyAuthenticate, fastifyAuthenticateOnly } from '../auth/fastify-auth';
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
} from '../../utils/schemas';
import {
  login,
  login2FA,
  refreshToken,
  logout,
  getPublicSettings,
  getMe,
} from '../../controllers/auth/login.controller';
import {
  register,
  sendPublicVerificationCode,
  verifyPublicEmail,
} from '../../controllers/auth/register.controller';
import {
  getPublicUsers,
  getUserProfile,
  getActivity,
  updateProfile,
  changePassword,
  uploadAvatar,
  uploadCover,
  sendVerificationCode,
  verifyEmail,
  sendCodeToNewEmail,
  changeEmail,
  getStats,
  getWorkbench,
  getLeaderboard,
  getUserSettings,
  updateUserSettings,
  getTrustedDevices,
  revokeTrustedDevice,
  exportAccountData,
  deleteAccount,
  forgotPasswordCheck,
  resetPasswordWith2FA,
} from '../../controllers/auth/profile.controller';
import {
  setup2FA,
  getRecoveryCodes,
  regenerateRecoveryCodes,
  enable2FA,
  disable2FA,
} from '../../controllers/auth/twoFactor.controller';
import {
  googleLogin,
  googleCallback,
  githubLogin,
  githubCallback,
} from '../../controllers/auth/oauth.controller';

import { fastifyUpload } from '../middlewares/fastify-upload.middleware';

/**
 * Fastify 认证路由（铁律六·1 渐进式迁移）。
 *
 * 所有 controller 已重写为原生 Fastify handler 签名
 * `(request: FastifyRequest, reply: FastifyReply) => Promise<void>`，
 * 因此本路由文件直接将 controller 函数作为 handler 传入 `app.get/post/put/delete`。
 *
 * 挂载前缀: /api/fastify/auth
 *
 * 路由级限流：对齐 Express authIpLimiter / authLimiter / passwordResetLimiter / emailLimiter
 */

// --- Params schemas ---

const userIdParamsSchema = z.object({
  id: z.string().min(1),
});

const trustedDeviceIdParamsSchema = z.object({
  id: z.string().min(1),
});

// --- Rate limit configs (对齐 Express 限流) ---

// 凭证类端点（注册/登录/2FA 登录）：authIpLimiter(200/15m) + authLimiter(20/15m)
const AUTH_CREDENTIAL_RATE_LIMIT = {
  max: 20,
  timeWindow: '15 minutes',
  errorMessage: '请求过于频繁，请稍后再试',
};
// 邮件验证码发送：emailLimiter(10/10m)
const EMAIL_RATE_LIMIT = {
  max: 10,
  timeWindow: '10 minutes',
  errorMessage: '请求过于频繁，请稍后再试',
};
// 密码重置：passwordResetLimiter(5/1h)
const PASSWORD_RESET_RATE_LIMIT = {
  max: 5,
  timeWindow: '1 hour',
  errorMessage: '请求过于频繁，请稍后再试',
};

export const registerAuthRoutes = (app: FastifyInstance): void => {
  // ── 公开端点（无需鉴权）──────────────────────────────────────────────

  app.post(
    '/auth/register',
    {
      schema: { body: registerSchema },
      config: { rateLimit: AUTH_CREDENTIAL_RATE_LIMIT },
    },
    register,
  );

  app.post(
    '/auth/email/send-code-public',
    {
      schema: { body: sendCodePublicSchema },
      config: { rateLimit: EMAIL_RATE_LIMIT },
    },
    sendPublicVerificationCode,
  );

  app.post(
    '/auth/email/verify-public',
    {
      schema: { body: verifyPublicEmailSchema },
    },
    verifyPublicEmail,
  );

  app.post(
    '/auth/login',
    {
      schema: { body: loginSchema },
      config: { rateLimit: AUTH_CREDENTIAL_RATE_LIMIT },
    },
    login,
  );

  app.post('/auth/refresh', refreshToken);

  app.post('/auth/logout', logout);

  app.get('/auth/settings', getPublicSettings);

  app.post(
    '/auth/login/2fa',
    {
      schema: { body: login2FASchema },
      config: { rateLimit: AUTH_CREDENTIAL_RATE_LIMIT },
    },
    login2FA,
  );

  app.post(
    '/auth/forgot-password/check',
    {
      schema: { body: forgotPasswordCheckSchema },
      config: { rateLimit: PASSWORD_RESET_RATE_LIMIT },
    },
    forgotPasswordCheck,
  );

  app.post(
    '/auth/forgot-password/reset-2fa',
    {
      schema: { body: resetPasswordWith2FASchema },
      config: { rateLimit: PASSWORD_RESET_RATE_LIMIT },
    },
    resetPasswordWith2FA,
  );

  // ── OAuth 端点（重定向到第三方）─────────────────────────────────────

  app.get('/auth/google', googleLogin);

  app.get('/auth/google/callback', googleCallback);

  app.get('/auth/github', githubLogin);

  app.get('/auth/github/callback', githubCallback);

  // ── 鉴权端点 ─────────────────────────────────────────────────────────

  app.get('/auth/me', { preHandler: [fastifyAuthenticate] }, getMe);

  app.get('/auth/users/public', { preHandler: [fastifyAuthenticate] }, getPublicUsers);

  app.get(
    '/auth/users/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: userIdParamsSchema },
    },
    getUserProfile,
  );

  app.get('/auth/activity', { preHandler: [fastifyAuthenticate] }, getActivity);

  app.put(
    '/auth/profile',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: profileSchema },
    },
    updateProfile,
  );

  app.put(
    '/auth/change-password',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: changePasswordSchema },
    },
    changePassword,
  );

  app.post(
    '/auth/email/send-code',
    {
      preHandler: [fastifyAuthenticate],
      config: { rateLimit: EMAIL_RATE_LIMIT },
    },
    sendVerificationCode,
  );

  app.post(
    '/auth/email/verify',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: verifyEmailSchema },
    },
    verifyEmail,
  );

  app.post(
    '/auth/email/send-code-new',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: sendCodeToNewEmailSchema },
      config: { rateLimit: EMAIL_RATE_LIMIT },
    },
    sendCodeToNewEmail,
  );

  app.put(
    '/auth/email/change',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: changeEmailSchema },
    },
    changeEmail,
  );

  // ── 2FA ───────────────────────────────────────────────────────────────

  app.put('/auth/2fa/setup', { preHandler: [fastifyAuthenticate] }, setup2FA);

  app.get('/auth/2fa/recovery-codes', { preHandler: [fastifyAuthenticate] }, getRecoveryCodes);

  app.post(
    '/auth/2fa/recovery-codes/regenerate',
    { preHandler: [fastifyAuthenticate] },
    regenerateRecoveryCodes,
  );

  app.post(
    '/auth/2fa/enable',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: enable2FASchema },
    },
    enable2FA,
  );

  app.post('/auth/2fa/disable', { preHandler: [fastifyAuthenticate] }, disable2FA);

  // ── 用户资料 / 统计 / 设置 ───────────────────────────────────────────

  app.get('/auth/stats', { preHandler: [fastifyAuthenticate] }, getStats);

  app.get('/auth/workbench', { preHandler: [fastifyAuthenticate] }, getWorkbench);

  app.get('/auth/leaderboard', { preHandler: [fastifyAuthenticate] }, getLeaderboard);

  // user-settings / trusted-devices / account 是个人范围接口，不涉及工作区
  // 使用 fastifyAuthenticateOnly 避免工作区解析失败导致的误判 403
  app.get('/auth/user-settings', { preHandler: [fastifyAuthenticateOnly] }, getUserSettings);

  app.post('/auth/user-settings', { preHandler: [fastifyAuthenticateOnly] }, updateUserSettings);

  // ── 可信设备 / 账户 ──────────────────────────────────────────────────

  app.get('/auth/trusted-devices', { preHandler: [fastifyAuthenticateOnly] }, getTrustedDevices);

  app.delete(
    '/auth/trusted-devices/:id',
    {
      preHandler: [fastifyAuthenticateOnly],
      schema: { params: trustedDeviceIdParamsSchema },
    },
    revokeTrustedDevice,
  );

  app.get('/auth/account/export', { preHandler: [fastifyAuthenticateOnly] }, exportAccountData);

  app.delete(
    '/auth/account',
    {
      preHandler: [fastifyAuthenticateOnly],
      schema: { body: deleteAccountSchema },
    },
    deleteAccount,
  );

  // POST /auth/upload-avatar —— 上传头像
  app.post(
    '/auth/upload-avatar',
    {
      preHandler: [fastifyAuthenticate, fastifyUpload([{ name: 'avatar', maxCount: 1 }])],
    },
    uploadAvatar,
  );

  // POST /auth/upload-cover —— 上传封面
  app.post(
    '/auth/upload-cover',
    {
      preHandler: [fastifyAuthenticate, fastifyUpload([{ name: 'cover', maxCount: 1 }])],
    },
    uploadCover,
  );
};
