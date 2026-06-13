import { logger } from '../utils/logger';
import axios from 'axios';
import prisma from './prisma';
import { decryptSecret, encryptSecret } from '../utils/secret-field';

interface SendMailParams {
  to: string;
  subject: string;
  content: string;
}

export class MicrosoftGraphService {
  /**
   * Helper to parse a proxy URL string into an Axios-compatible proxy configuration object
   */
  private static parseProxy(proxyUrl: string | null) {
    if (!proxyUrl) return undefined;
    try {
      const url = new URL(proxyUrl);
      const config: any = {
        protocol: url.protocol.replace(':', ''),
        host: url.hostname,
        port: parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 80),
      };
      if (url.username) {
        config.auth = {
          username: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password || ''),
        };
      }
      return config;
    } catch (e) {
      logger.error('MicrosoftGraphService: Error parsing proxy URL', e);
      return undefined;
    }
  }

  /**
   * Refreshes the Access Token for a Microsoft Account using its Client ID and Refresh Token
   */
  public static async refreshAccessToken(accountId: string): Promise<string> {
    const account = await prisma.microsoftEmailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    try {
      const params = new URLSearchParams();
      params.append('client_id', account.clientId);
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', decryptSecret(account.refreshToken) || account.refreshToken);
      params.append('scope', 'https://graph.microsoft.com/.default');

      const proxyConfig = this.parseProxy(decryptSecret(account.proxy));

      const response = await axios.post(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent':
              account.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          proxy: proxyConfig,
          timeout: 10000,
        },
      );

      const data = response.data;
      if (!data.access_token) {
        throw new Error('No access token returned in response');
      }

      // Calculate expiration time (usually 3600 seconds)
      const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

      // Save token updates
      await prisma.microsoftEmailAccount.update({
        where: { id: accountId },
        data: {
          accessToken: encryptSecret(data.access_token),
          tokenExpiresAt: expiresAt,
          // Microsoft rotates refresh tokens occasionally, update if a new one is returned
          refreshToken:
            encryptSecret(data.refresh_token || decryptSecret(account.refreshToken)) ||
            account.refreshToken,
          status: 'ACTIVE',
          statusMessage: 'Token refreshed successfully',
        },
      });

      return data.access_token;
    } catch (error) {
      const responseStatus = (error as any).response?.status;
      const responseData = (error as any).response?.data;
      const errorMsg =
        responseData?.error_description ||
        (error instanceof Error ? error.message : String(error)) ||
        'Unknown error refreshing token';
      logger.error(`MicrosoftGraphService: Refresh failed for ${account.email}:`, errorMsg);

      const isOAuthError = responseStatus >= 400 && responseStatus < 500;

      if (isOAuthError) {
        // Real credential/OAuth expiration: mark as EXPIRED
        await prisma.microsoftEmailAccount.update({
          where: { id: accountId },
          data: {
            status: 'EXPIRED',
            statusMessage: `OAuth Error: ${errorMsg}`,
          },
        });
      } else {
        // Temporary network timeout, proxy issue, or 5xx server error: keep ACTIVE to auto-retry
        await prisma.microsoftEmailAccount.update({
          where: { id: accountId },
          data: {
            statusMessage: `Temporary network error: ${errorMsg}`,
          },
        });
      }
      throw new Error(`Token refresh failed: ${errorMsg}`);
    }
  }

  /**
   * Retrieves a valid access token. If the cached one is valid, returns it; otherwise refreshes it.
   */
  public static async getValidAccessToken(accountId: string): Promise<string> {
    const account = await prisma.microsoftEmailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const now = new Date();
    // Refresh token if it's expired or about to expire in the next 2 minutes
    if (
      account.accessToken &&
      account.tokenExpiresAt &&
      new Date(account.tokenExpiresAt.getTime() - 120 * 1000) > now
    ) {
      return decryptSecret(account.accessToken) || account.accessToken;
    }

    return await this.refreshAccessToken(accountId);
  }

  /**
   * Tests the connection validity of a Microsoft Account by requesting the profile endpoint
   */
  public static async testConnection(accountId: string): Promise<any> {
    const account = await prisma.microsoftEmailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    try {
      const token = await this.getValidAccessToken(accountId);
      const proxyConfig = this.parseProxy(decryptSecret(account.proxy));

      // Use /me/mailFolders instead of /me, as personal accounts (Outlook/Hotmail) can return 401 UnknownError on /me
      const response = await axios.get('https://graph.microsoft.com/v1.0/me/mailFolders', {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent':
            account.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        proxy: proxyConfig,
        timeout: 10000,
      });

      // Update status to ACTIVE since endpoint returned profile successfully
      await prisma.microsoftEmailAccount.update({
        where: { id: accountId },
        data: {
          status: 'ACTIVE',
          statusMessage: 'Connection tested successfully',
        },
      });

      return response.data;
    } catch (error) {
      const errorMsg =
        (error as any).response?.data?.error?.message ||
        (error instanceof Error ? error.message : String(error)) ||
        'Connection test failed';
      logger.error(`MicrosoftGraphService: Test connection failed for ${account.email}:`, errorMsg);

      await prisma.microsoftEmailAccount.update({
        where: { id: accountId },
        data: {
          status: 'ERROR',
          statusMessage: errorMsg,
        },
      });
      throw new Error(errorMsg);
    }
  }

  /**
   * Fetches folders for the Microsoft account
   */
  public static async fetchFolders(accountId: string): Promise<any[]> {
    try {
      const token = await this.getValidAccessToken(accountId);
      const account = await prisma.microsoftEmailAccount.findUnique({ where: { id: accountId } });
      const proxyConfig = this.parseProxy(decryptSecret(account?.proxy));

      const response = await axios.get('https://graph.microsoft.com/v1.0/me/mailFolders', {
        headers: { Authorization: `Bearer ${token}` },
        proxy: proxyConfig,
      });
      return response.data.value || [];
    } catch (error) {
      logger.error(
        `MicrosoftGraphService: Fetch folders failed for ${accountId}:`,
        error instanceof Error ? error.message : error,
      );
      throw new Error(
        (error as any).response?.data?.error?.message ||
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /**
   * Fetches mail messages inside a specific folder
   */
  public static async fetchMessages(
    accountId: string,
    folderId: string = 'inbox',
    limit: number = 20,
  ): Promise<any[]> {
    try {
      const token = await this.getValidAccessToken(accountId);
      const account = await prisma.microsoftEmailAccount.findUnique({ where: { id: accountId } });
      const proxyConfig = this.parseProxy(decryptSecret(account?.proxy));

      // Fetch headers and basic body preview
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages?$top=${limit}&$select=id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,hasAttachments,isRead`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent':
              account?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          proxy: proxyConfig,
        },
      );
      return response.data.value || [];
    } catch (error) {
      logger.error(
        `MicrosoftGraphService: Fetch messages failed for folder ${folderId} inside ${accountId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        (error as any).response?.data?.error?.message ||
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /**
   * Updates an email read status on Microsoft
   */
  public static async markMessageRead(
    accountId: string,
    messageId: string,
    isRead: boolean,
  ): Promise<void> {
    try {
      const token = await this.getValidAccessToken(accountId);
      const account = await prisma.microsoftEmailAccount.findUnique({ where: { id: accountId } });
      const proxyConfig = this.parseProxy(decryptSecret(account?.proxy));

      await axios.patch(
        `https://graph.microsoft.com/v1.0/me/messages/${messageId}`,
        { isRead },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          proxy: proxyConfig,
        },
      );
    } catch (error) {
      logger.error(
        `MicrosoftGraphService: Mark message read failed for message ${messageId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        (error as any).response?.data?.error?.message ||
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /**
   * Deletes a message from Microsoft (moves to Deleted Items if not already there, otherwise permanently deletes)
   */
  public static async deleteMessage(accountId: string, messageId: string): Promise<void> {
    try {
      const token = await this.getValidAccessToken(accountId);
      const account = await prisma.microsoftEmailAccount.findUnique({ where: { id: accountId } });
      const proxyConfig = this.parseProxy(decryptSecret(account?.proxy));

      // 1. Fetch message details to find its parentFolderId
      const msgRes = await axios.get(
        `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=parentFolderId`,
        {
          headers: { Authorization: `Bearer ${token}` },
          proxy: proxyConfig,
        },
      );
      const parentFolderId = msgRes.data?.parentFolderId;

      // 2. Fetch the resolved ID of the well-known 'deleteditems' folder
      const delFolderRes = await axios.get(
        'https://graph.microsoft.com/v1.0/me/mailFolders/deleteditems?$select=id',
        {
          headers: { Authorization: `Bearer ${token}` },
          proxy: proxyConfig,
        },
      );
      const deletedItemsFolderId = delFolderRes.data?.id;

      if (parentFolderId && parentFolderId === deletedItemsFolderId) {
        // Already in Deleted Items - perform permanent delete
        await axios.delete(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
          headers: { Authorization: `Bearer ${token}` },
          proxy: proxyConfig,
        });
      } else {
        // Move to Deleted Items (soft delete)
        await axios.post(
          `https://graph.microsoft.com/v1.0/me/messages/${messageId}/move`,
          { destinationId: 'deleteditems' },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            proxy: proxyConfig,
          },
        );
      }
    } catch (error) {
      logger.error(
        `MicrosoftGraphService: Delete message failed for message ${messageId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        (error as any).response?.data?.error?.message ||
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /**
   * Sends an email via Microsoft Graph API
   */
  public static async sendMail(accountId: string, params: SendMailParams): Promise<void> {
    const account = await prisma.microsoftEmailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Safety Checks: Daily Limits
    const now = new Date();
    const isSameDay = now.toDateString() === new Date(account.lastResetDate).toDateString();

    let currentSendsWithinDay = account.sentCountToday;
    if (!isSameDay) {
      currentSendsWithinDay = 0;
      await prisma.microsoftEmailAccount.update({
        where: { id: accountId },
        data: {
          sentCountToday: 0,
          lastResetDate: now,
        },
      });
    }

    if (currentSendsWithinDay >= account.dailyLimit) {
      throw new Error(
        `Daily sending limit of ${account.dailyLimit} reached for account ${account.email}.`,
      );
    }

    // Support comma, semicolon, or space separated multiple recipients
    const recipients = params.to
      .split(/[,;\s]+/)
      .map((email) => email.trim())
      .filter((email) => email.length > 0 && email.includes('@'));

    if (recipients.length === 0) {
      throw new Error('未找到有效的收件人邮箱地址');
    }

    const toRecipients = recipients.map((email) => ({
      emailAddress: {
        address: email,
      },
    }));

    const emailPayload = {
      message: {
        subject: params.subject,
        body: {
          contentType: 'HTML',
          content: params.content,
        },
        toRecipients,
      },
      saveToSentItems: 'true',
    };

    try {
      const token = await this.getValidAccessToken(accountId);
      const proxyConfig = this.parseProxy(decryptSecret(account.proxy));

      await axios.post('https://graph.microsoft.com/v1.0/me/sendMail', emailPayload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent':
            account.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        proxy: proxyConfig,
        timeout: 15000,
      });

      // Increment sending counters
      await prisma.microsoftEmailAccount.update({
        where: { id: accountId },
        data: {
          sentCountToday: { increment: 1 },
        },
      });
    } catch (error) {
      const errorMsg =
        (error as any).response?.data?.error?.message ||
        (error instanceof Error ? error.message : String(error)) ||
        'Failed to send mail';
      logger.error(`MicrosoftGraphService: Send mail failed for ${account.email}:`, errorMsg);
      throw new Error(errorMsg);
    }
  }
}
