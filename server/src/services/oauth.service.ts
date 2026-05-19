import axios from 'axios';
import prisma from './prisma';
import { config } from '../config/env';

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export class OAuthService {
  private static async getSetting(key: string): Promise<string | null> {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting ? setting.value : null;
  }

  // --- Google ---
  static async getGoogleAuthUrl(state: string): Promise<string> {
    const clientId = await this.getSetting('OAUTH_GOOGLE_CLIENT_ID');
    const redirectUri = `${config.BACKEND_URL}/api/auth/google/callback`;

    if (!clientId) throw new Error('Google OAuth is not configured');

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: redirectUri,
      client_id: clientId,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      state,
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  static async getGoogleUser(code: string): Promise<OAuthUserInfo> {
    const clientId = await this.getSetting('OAUTH_GOOGLE_CLIENT_ID');
    const clientSecret = await this.getSetting('OAUTH_GOOGLE_CLIENT_SECRET');
    const redirectUri = `${config.BACKEND_URL}/api/auth/google/callback`;

    if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured');

    const url = 'https://oauth2.googleapis.com/token';
    const values = {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };

    const res = await axios.post(url, new URLSearchParams(values), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = res.data;

    const userRes = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
      },
    );

    return {
      id: userRes.data.id,
      email: userRes.data.email,
      name: userRes.data.name || userRes.data.given_name,
      avatarUrl: userRes.data.picture,
    };
  }

  // --- GitHub ---
  static async getGithubAuthUrl(state: string): Promise<string> {
    const clientId = await this.getSetting('OAUTH_GITHUB_CLIENT_ID');
    const redirectUri = `${config.BACKEND_URL}/api/auth/github/callback`;

    if (!clientId) throw new Error('GitHub OAuth is not configured');

    const rootUrl = 'https://github.com/login/oauth/authorize';
    const options = {
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  static async getGithubUser(code: string): Promise<OAuthUserInfo> {
    const clientId = await this.getSetting('OAUTH_GITHUB_CLIENT_ID');
    const clientSecret = await this.getSetting('OAUTH_GITHUB_CLIENT_SECRET');

    if (!clientId || !clientSecret) throw new Error('GitHub OAuth is not configured');

    const url = 'https://github.com/login/oauth/access_token';
    const values = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    };

    const res = await axios.post(url, values, {
      headers: { Accept: 'application/json' },
    });

    const { access_token } = res.data;

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    // GitHub emails are separate
    const emailsRes = await axios.get('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const primaryEmail =
      emailsRes.data.find((e: any) => e.primary && e.verified)?.email || emailsRes.data[0].email;

    return {
      id: String(userRes.data.id),
      email: primaryEmail,
      name: userRes.data.name || userRes.data.login,
      avatarUrl: userRes.data.avatar_url,
    };
  }
}
