import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../services/prisma';
import { config } from '../../config/env';
import { generateAccessToken, generateRefreshToken } from '../../utils/auth';
import { settingsService } from '../../services/settings.service';
import { OAuthService } from '../../services/oauth.service';
import { AppError } from '../../middlewares/error.middleware';

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.getAll();
    if (!settings.OAUTH_GOOGLE_ENABLED) {
      return next(new AppError('Google OAuth is not enabled', 400));
    }
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });
    const url = await OAuthService.getGoogleAuthUrl(state);
    res.redirect(url);
  } catch (error) {
    next(error);
  }
};

export const googleCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const cookieState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state');

  if (!state || state !== cookieState) {
    return res.redirect(`${config.FRONTEND_URL}/login?error=csrf_detected`);
  }

  if (!code) return res.redirect(`${config.FRONTEND_URL}/login?error=no_code`);

  try {
    const settings = await settingsService.getAll();
    if (!settings.OAUTH_GOOGLE_ENABLED) {
      return res.redirect(`${config.FRONTEND_URL}/login?error=oauth_not_enabled`);
    }
    const oauthUser = await OAuthService.getGoogleUser(code as string);
    let user = await prisma.user.findUnique({ where: { googleId: oauthUser.id } });

    if (!user) {
      // Try by email for automatic linking
      user = await prisma.user.findUnique({ where: { email: oauthUser.email } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: oauthUser.id },
        });
      } else {
        // Create new user
        const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: oauthUser.email,
              password: hashedPassword,
              name: oauthUser.name,
              avatarUrl: oauthUser.avatarUrl,
              googleId: oauthUser.id,
              emailVerified: true,
            },
          });
          // Initial setup (teams etc)
          await tx.team.create({
            data: {
              name: `${oauthUser.name} 的个人空间`,
              type: 'PERSONAL',
              visibility: 'PRIVATE',
              ownerId: newUser.id,
              members: { create: { userId: newUser.id, role: 'OWNER' } },
            },
          });
          return newUser;
        });
      }
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = await generateRefreshToken(user.id);
    res.redirect(`${config.FRONTEND_URL}/login?token=${accessToken}&refreshToken=${refreshToken}`);
  } catch (error) {
    res.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
  }
};

export const githubLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.getAll();
    if (!settings.OAUTH_GITHUB_ENABLED) {
      return next(new AppError('GitHub OAuth is not enabled', 400));
    }
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });
    const url = await OAuthService.getGithubAuthUrl(state);
    res.redirect(url);
  } catch (error) {
    next(error);
  }
};

export const githubCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const cookieState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state');

  if (!state || state !== cookieState) {
    return res.redirect(`${config.FRONTEND_URL}/login?error=csrf_detected`);
  }

  if (!code) return res.redirect(`${config.FRONTEND_URL}/login?error=no_code`);

  try {
    const settings = await settingsService.getAll();
    if (!settings.OAUTH_GITHUB_ENABLED) {
      return res.redirect(`${config.FRONTEND_URL}/login?error=oauth_not_enabled`);
    }
    const oauthUser = await OAuthService.getGithubUser(code as string);
    let user = await prisma.user.findUnique({ where: { githubId: oauthUser.id } });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: oauthUser.email } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { githubId: oauthUser.id },
        });
      } else {
        const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: oauthUser.email,
              password: hashedPassword,
              name: oauthUser.name,
              avatarUrl: oauthUser.avatarUrl,
              githubId: oauthUser.id,
              emailVerified: true,
            },
          });
          await tx.team.create({
            data: {
              name: `${oauthUser.name} 的个人空间`,
              type: 'PERSONAL',
              visibility: 'PRIVATE',
              ownerId: newUser.id,
              members: { create: { userId: newUser.id, role: 'OWNER' } },
            },
          });
          return newUser;
        });
      }
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = await generateRefreshToken(user.id);
    res.redirect(`${config.FRONTEND_URL}/login?token=${accessToken}&refreshToken=${refreshToken}`);
  } catch (error) {
    res.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
  }
};
