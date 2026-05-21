import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  password: z
    .string()
    .min(6, '密码长度需在 6-128 位之间')
    .max(128, '密码长度需在 6-128 位之间'),
  name: z.string().max(50, '名字长度不能超过 50 位').optional().nullable(),
  verificationCode: z.string().length(6, '验证码需为 6 位'),
});

export const sendCodePublicSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
});

export const verifyPublicEmailSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  code: z.string().length(6, '验证码需为 6 位'),
});

export const loginSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  password: z.string().min(1, '密码不能为空'),
  deviceToken: z.string().optional(),
});

export const login2FASchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  code: z.string().length(6, '验证码需为 6 位'),
  rememberDevice: z.boolean().optional(),
});

export const forgotPasswordCheckSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
});

export const resetPasswordWith2FASchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  code: z.string().length(6, '验证码需为 6 位'),
  newPassword: z
    .string()
    .min(6, '密码长度需在 6-128 位之间')
    .max(128, '密码长度需在 6-128 位之间'),
});

export const profileSchema = z.object({
  name: z.string().max(50, '名字长度不能超过 50 位').optional().nullable(),
  bio: z.string().max(500, '个人简介长度不能超过 500 位').optional().nullable(),
  location: z.string().max(100, '所在地长度不能超过 100 位').optional().nullable(),
  website: z.string().max(255, '个人网站长度不能超过 255 位').optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z
    .string()
    .min(6, '新密码长度需在 6-128 位之间')
    .max(128, '新密码长度需在 6-128 位之间'),
});

export const verifyEmailSchema = z.object({
  code: z.string().length(6, '验证码需为 6 位'),
});

export const sendCodeToNewEmailSchema = z.object({
  newEmail: z.string().email('无效的邮箱格式'),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email('无效的邮箱格式'),
  code: z.string().length(6, '验证码需为 6 位'),
});

export const enable2FASchema = z.object({
  code: z.string().length(6, '验证码需为 6 位'),
});

export const deleteAccountSchema = z.object({
  twoFactorCode: z.string().length(6, '验证码需为 6 位').optional().nullable(),
  password: z.string().optional().nullable(),
});

export const createUserSchema = z.object({
  name: z.string().max(50, '名字长度不能超过 50 位').optional().nullable(),
  email: z.string().email('无效的邮箱格式'),
  password: z
    .string()
    .min(6, '密码长度需在 6-128 位之间')
    .max(128, '密码长度需在 6-128 位之间'),
  role: z.enum(['USER', 'ADMIN', 'INSTRUCTOR']).optional(),
});
