import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password length must be 6-128 characters').max(128),
  name: z.string().max(50, 'Name must be 50 characters or fewer').optional().nullable(),
  verificationCode: z.string().length(6, 'Verification code must be 6 digits'),
});

export const sendCodePublicSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const verifyPublicEmailSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  deviceToken: z.string().optional(),
});

export const login2FASchema = z.object({
  userId: z.string().min(1, 'User id is required'),
  code: z.string().regex(/^(\d{6}|[A-Fa-f0-9]{8})$/, 'Invalid 2FA or recovery code format'),
  rememberDevice: z.boolean().optional(),
});

export const forgotPasswordCheckSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordWith2FASchema = z.object({
  email: z.string().email('Invalid email format'),
  resetCode: z.string().length(6, 'Email verification code must be 6 digits'),
  twoFactorCode: z.string().length(6, '2FA code must be 6 digits'),
  newPassword: z.string().min(6, 'Password length must be 6-128 characters').max(128),
});

export const profileSchema = z.object({
  name: z.string().max(50, 'Name must be 50 characters or fewer').optional().nullable(),
  bio: z.string().max(500, 'Bio must be 500 characters or fewer').optional().nullable(),
  location: z.string().max(100, 'Location must be 100 characters or fewer').optional().nullable(),
  website: z.string().max(255, 'Website must be 255 characters or fewer').optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'Password length must be 6-128 characters').max(128),
});

export const verifyEmailSchema = z.object({
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export const sendCodeToNewEmailSchema = z.object({
  newEmail: z.string().email('Invalid email format'),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export const enable2FASchema = z.object({
  code: z.string().length(6, '2FA code must be 6 digits'),
  password: z.string().min(1, 'Password is required'),
});

export const deleteAccountSchema = z.object({
  twoFactorCode: z.string().length(6, '2FA code must be 6 digits').optional().nullable(),
  password: z.string().optional().nullable(),
});

export const createUserSchema = z.object({
  name: z.string().max(50, 'Name must be 50 characters or fewer').optional().nullable(),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password length must be 6-128 characters').max(128),
  role: z.enum(['USER', 'ADMIN', 'INSTRUCTOR']).optional(),
});
