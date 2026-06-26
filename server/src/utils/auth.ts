import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import prisma from '../services/prisma';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

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
  return Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase(),
  );
};

export const hashRecoveryCodes = async (codes: string[]) => {
  return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
};

export const verifyRecoveryCode = async (
  storedCodesRaw: string | null | undefined,
  submittedCode: string,
) => {
  if (!storedCodesRaw || !submittedCode) {
    return { valid: false, remainingCodes: [] as string[] };
  }

  let storedCodes: string[];
  try {
    storedCodes = JSON.parse(storedCodesRaw);
  } catch {
    return { valid: false, remainingCodes: [] as string[] };
  }

  const normalizedCode = submittedCode.toUpperCase();
  for (let index = 0; index < storedCodes.length; index++) {
    const storedCode = storedCodes[index];
    if (!storedCode) continue;

    const isLegacyPlaintext = storedCode === normalizedCode;
    const isHashed =
      storedCode.startsWith('$2') && (await bcrypt.compare(normalizedCode, storedCode));

    if (isLegacyPlaintext || isHashed) {
      return {
        valid: true,
        remainingCodes: storedCodes.filter((_, codeIndex) => codeIndex !== index),
      };
    }
  }

  return { valid: false, remainingCodes: storedCodes };
};

export const sanitizeUser = (user: Record<string, unknown> | null) => {
  if (!user) return null;
  const {
    password: _password,
    twoFactorSecret: _twoFactorSecret,
    twoFactorRecoveryCodes: _twoFactorRecoveryCodes,
    ...safeUser
  } = user;
  return safeUser;
};
