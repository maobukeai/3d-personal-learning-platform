import type { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../services/prisma';
import { config } from '../../config/env';
import { generateAccessToken, generateRefreshToken } from '../../utils/auth';
import { settingsService } from '../../services/settings.service';
import { OAuthService } from '../../services/oauth.service';
import { AppError } from '../../utils/error';
import { provisionUserWorkspaces } from '../../services/user-workspace.service';

const frontendLoginUrl = (query: string) =>
  `${config.FRONTEND_URL.replace(/\/$/, '')}/login?${query}`;

const setAuthCookies = (reply: FastifyReply, accessToken: string, refreshToken: string) => {
  const cookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };

  reply.setCookie('token', accessToken, { ...cookieOptions, maxAge: 60 * 60 * 1000 });
  reply.setCookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const csrfToken = crypto.randomBytes(32).toString('hex');
  reply.setCookie('csrfToken', csrfToken, {
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    httpOnly: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const googleLogin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    const settings = await settingsService.getAll();
    if (!settings.OAUTH_GOOGLE_ENABLED) {
      throw new AppError('Google OAuth is not enabled', 400);
    }
    const state = crypto.randomBytes(16).toString('hex');
    reply.setCookie('oauth_state', state, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });
    const url = await OAuthService.getGoogleAuthUrl(state);
    reply.redirect(url);
  } catch (error) {
    throw error;
  }
};

export const googleCallback = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { code, state } = request.query as { code?: string; state?: string };
  const cookieState = (request.cookies as { oauth_state?: string } | undefined)?.oauth_state;
  reply.clearCookie('oauth_state');

  if (!state || state !== cookieState) {
    reply.redirect(frontendLoginUrl('error=csrf_detected'));
    return;
  }

  if (!code) {
    reply.redirect(frontendLoginUrl('error=no_code'));
    return;
  }

  try {
    const settings = await settingsService.getAll();
    if (!settings.OAUTH_GOOGLE_ENABLED) {
      reply.redirect(frontendLoginUrl('error=oauth_not_enabled'));
      return;
    }
    const oauthUser = await OAuthService.getGoogleUser(code);
    let user = await prisma.user.findUnique({ where: { googleId: oauthUser.id } });

    if (!user) {
      // Try by email for automatic linking
      user = await prisma.user.findUnique({ where: { email: oauthUser.email } });
      if (user) {
        reply.redirect(frontendLoginUrl('error=email_exists'));
        return;
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
          await provisionUserWorkspaces(tx, {
            userId: newUser.id,
            displayName: oauthUser.name || oauthUser.email,
          });
          return newUser;
        });
      }
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = await generateRefreshToken(user.id);
    setAuthCookies(reply, accessToken, refreshToken);
    reply.redirect(frontendLoginUrl('oauth=success'));
  } catch (_error) {
    reply.redirect(frontendLoginUrl('error=oauth_failed'));
  }
};

export const githubLogin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    const settings = await settingsService.getAll();
    if (!settings.OAUTH_GITHUB_ENABLED) {
      throw new AppError('GitHub OAuth is not enabled', 400);
    }
    const state = crypto.randomBytes(16).toString('hex');
    reply.setCookie('oauth_state', state, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });
    const url = await OAuthService.getGithubAuthUrl(state);
    reply.redirect(url);
  } catch (error) {
    throw error;
  }
};

export const githubCallback = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { code, state } = request.query as { code?: string; state?: string };
  const cookieState = (request.cookies as { oauth_state?: string } | undefined)?.oauth_state;
  reply.clearCookie('oauth_state');

  if (!state || state !== cookieState) {
    reply.redirect(frontendLoginUrl('error=csrf_detected'));
    return;
  }

  if (!code) {
    reply.redirect(frontendLoginUrl('error=no_code'));
    return;
  }

  try {
    const settings = await settingsService.getAll();
    if (!settings.OAUTH_GITHUB_ENABLED) {
      reply.redirect(frontendLoginUrl('error=oauth_not_enabled'));
      return;
    }
    const oauthUser = await OAuthService.getGithubUser(code);
    let user = await prisma.user.findUnique({ where: { githubId: oauthUser.id } });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: oauthUser.email } });
      if (user) {
        reply.redirect(frontendLoginUrl('error=email_exists'));
        return;
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
          await provisionUserWorkspaces(tx, {
            userId: newUser.id,
            displayName: oauthUser.name || oauthUser.email,
          });
          return newUser;
        });
      }
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = await generateRefreshToken(user.id);
    setAuthCookies(reply, accessToken, refreshToken);
    reply.redirect(frontendLoginUrl('oauth=success'));
  } catch (_error) {
    reply.redirect(frontendLoginUrl('error=oauth_failed'));
  }
};
