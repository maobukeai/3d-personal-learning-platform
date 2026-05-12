import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for register/login
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/login/2fa', authLimiter, authController.login2FA);

router.post('/forgot-password/check', authLimiter, authController.forgotPasswordCheck);
router.post('/forgot-password/reset-2fa', authLimiter, authController.resetPasswordWith2FA);

router.get('/me', authenticate, authController.getMe);
router.get('/users/public', authenticate, authController.getPublicUsers);
router.get('/users/:id', authenticate, authController.getUserProfile);
router.get('/activity', authenticate, authController.getActivity);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, authController.changePassword);

router.post('/email/send-code', authenticate, authController.sendVerificationCode);
router.post('/email/verify', authenticate, authController.verifyEmail);
router.post('/email/send-code-new', authenticate, authController.sendCodeToNewEmail);
router.put('/email/change', authenticate, authController.changeEmail);

router.put('/2fa/setup', authenticate, authController.setup2FA);
router.post('/2fa/enable', authenticate, authController.enable2FA);
router.post('/2fa/disable', authenticate, authController.disable2FA);

router.post('/upload-avatar', authenticate, upload.single('avatar'), validateFileContent, authController.uploadAvatar);
router.get('/stats', authenticate, authController.getStats);

export default router;
