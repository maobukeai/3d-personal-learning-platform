import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';
import { validate, sanitizeInput } from '../middlewares/validation.middleware';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '请求过于频繁，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: '密码重置请求过于频繁，请 1 小时后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { error: '邮件发送请求过于频繁，请 10 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, sanitizeInput, validate({
  email: { type: 'email', required: true, maxLength: 255 },
  password: { type: 'string', required: true, minLength: 6, maxLength: 128, message: '密码长度需在 6-128 位之间' },
  name: { type: 'string', required: false, maxLength: 50 }
}), authController.register);

router.post('/login', authLimiter, sanitizeInput, validate({
  email: { type: 'string', required: true },
  password: { type: 'string', required: true }
}), authController.login);

router.get('/settings', authController.getPublicSettings);

router.post('/login/2fa', authLimiter, sanitizeInput, validate({
  userId: { type: 'string', required: true },
  code: { type: 'string', required: true, minLength: 6, maxLength: 6 }
}), authController.login2FA);

router.post('/forgot-password/check', passwordResetLimiter, sanitizeInput, validate({
  email: { type: 'email', required: true }
}), authController.forgotPasswordCheck);

router.post('/forgot-password/reset-2fa', passwordResetLimiter, sanitizeInput, validate({
  email: { type: 'email', required: true },
  code: { type: 'string', required: true, minLength: 6, maxLength: 6 },
  newPassword: { type: 'string', required: true, minLength: 6, maxLength: 128, message: '密码长度需在 6-128 位之间' }
}), authController.resetPasswordWith2FA);

router.get('/me', authenticate, authController.getMe);
router.get('/users/public', authenticate, authController.getPublicUsers);
router.get('/users/:id', authenticate, authController.getUserProfile);
router.get('/activity', authenticate, authController.getActivity);

router.put('/profile', authenticate, sanitizeInput, validate({
  name: { type: 'string', required: false, maxLength: 50 },
  bio: { type: 'string', required: false, maxLength: 500 },
  location: { type: 'string', required: false, maxLength: 100 },
  website: { type: 'string', required: false, maxLength: 255 }
}), authController.updateProfile);

router.put('/change-password', authenticate, sanitizeInput, validate({
  currentPassword: { type: 'string', required: true },
  newPassword: { type: 'string', required: true, minLength: 6, maxLength: 128, message: '新密码长度需在 6-128 位之间' }
}), authController.changePassword);

router.post('/email/send-code', authenticate, emailLimiter, authController.sendVerificationCode);
router.post('/email/verify', authenticate, sanitizeInput, validate({
  code: { type: 'string', required: true, minLength: 6, maxLength: 6 }
}), authController.verifyEmail);

router.post('/email/send-code-new', authenticate, emailLimiter, sanitizeInput, validate({
  newEmail: { type: 'email', required: true }
}), authController.sendCodeToNewEmail);

router.put('/email/change', authenticate, sanitizeInput, validate({
  newEmail: { type: 'email', required: true },
  code: { type: 'string', required: true, minLength: 6, maxLength: 6 }
}), authController.changeEmail);

router.put('/2fa/setup', authenticate, authController.setup2FA);
router.post('/2fa/enable', authenticate, sanitizeInput, validate({
  code: { type: 'string', required: true, minLength: 6, maxLength: 6 }
}), authController.enable2FA);
router.post('/2fa/disable', authenticate, authController.disable2FA);

router.post('/upload-avatar', authenticate, upload.single('avatar'), validateFileContent, authController.uploadAvatar);
router.get('/stats', authenticate, authController.getStats);

router.get('/user-settings', authenticate, authController.getUserSettings);
router.post('/user-settings', authenticate, authController.updateUserSettings);
router.get('/trusted-devices', authenticate, authController.getTrustedDevices);
router.delete('/trusted-devices/:id', authenticate, authController.revokeTrustedDevice);
router.delete('/account', authenticate, sanitizeInput, validate({
  twoFactorCode: { type: 'string', required: false, minLength: 6, maxLength: 6 }
}), authController.deleteAccount);

export default router;
