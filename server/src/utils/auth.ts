import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import prisma from '../services/prisma';
import crypto from 'crypto';

const ACCESS_TOKEN_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7;

export const generateAccessToken = (userId: string, role: string) => {
  return jwt.sign({ id: userId, role }, config.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

export const generateRefreshToken = async (userId: string) => {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
};

export const generateRecoveryCodes = () => {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase()); // 8 chars code
  }
  return codes;
};

export const sanitizeUser = (user: any) => {
  if (!user) return null;
  const {
    password: _password,
    twoFactorSecret: _twoFactorSecret,
    twoFactorRecoveryCodes: _twoFactorRecoveryCodes,
    ...safeUser
  } = user;
  return safeUser;
};
