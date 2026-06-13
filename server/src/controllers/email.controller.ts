import { logger } from '../utils/logger';
import { AuthRequest } from '../middlewares/auth.middleware';
import type { MicrosoftEmailAccount } from '@prisma/client';
import { Response } from 'express';
import prisma from '../services/prisma';
import { MicrosoftGraphService } from '../services/microsoftGraph.service';
import { encryptSecret, maskProxyUrl } from '../utils/secret-field';

const toPublicEmailAccount = (account: MicrosoftEmailAccount) => ({
  id: account.id,
  userId: account.userId,
  email: account.email,
  clientId: account.clientId,
  tokenExpiresAt: account.tokenExpiresAt,
  status: account.status,
  statusMessage: account.statusMessage,
  proxy: maskProxyUrl(account.proxy),
  userAgent: account.userAgent,
  dailyLimit: account.dailyLimit,
  sentCountToday: account.sentCountToday,
  lastResetDate: account.lastResetDate,
  minDelay: account.minDelay,
  maxDelay: account.maxDelay,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
  hasPassword: Boolean(account.password),
  hasRefreshToken: Boolean(account.refreshToken),
  hasAccessToken: Boolean(account.accessToken),
});

export class EmailController {
  /**
   * Bulk imports Microsoft accounts from a raw text payload
   * Format: email----password----client_id----refreshToken (dual-token generic)
   */
  public static async importAccounts(req: AuthRequest, res: Response): Promise<void> {
    const { importData, proxy, minDelay, maxDelay, dailyLimit } = req.body;
    const userId = req.userId as string;

    if (!importData || typeof importData !== 'string') {
      res.status(400).json({ error: '请提供有效的导入数据内容' });
      return;
    }

    const lines = importData
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const parsedAccounts: Array<{
      email: string;
      password?: string;
      clientId: string;
      refreshToken: string;
    }> = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.split('----').map((part) => part.trim());

      // We need at least email, client_id, and refresh_token
      // Standard: 邮箱----密码----client_id----令牌
      if (parts.length < 3) {
        errors.push(
          `第 ${i + 1} 行格式不正确，缺少字段。要求格式: 邮箱----密码----client_id----令牌`,
        );
        continue;
      }

      const [email, password, clientId, token] =
        parts.length === 3
          ? [parts[0] || '', '', parts[1] || '', parts[2] || '']
          : [parts[0] || '', parts[1] || '', parts[2] || '', parts[3] || ''];

      if (!email.includes('@') || !clientId || !token) {
        errors.push(`第 ${i + 1} 行数据内容无效。请确保邮箱、Client ID及令牌完整且有效`);
        continue;
      }

      parsedAccounts.push({
        email,
        password,
        clientId,
        refreshToken: token,
      });
    }

    if (parsedAccounts.length === 0) {
      res.status(400).json({ error: '解析失败，未找到有效的账号记录', details: errors });
      return;
    }

    try {
      const results = [];
      for (const account of parsedAccounts) {
        const existingAccount = await prisma.microsoftEmailAccount.findUnique({
          where: { email: account.email },
          select: { userId: true },
        });

        if (existingAccount && existingAccount.userId !== userId) {
          errors.push(`账号 ${account.email} 已存在，无法导入到当前用户`);
          continue;
        }

        // Create or update based on unique email
        const record = await prisma.microsoftEmailAccount.upsert({
          where: { email: account.email },
          update: {
            password: encryptSecret(account.password) || undefined,
            clientId: account.clientId,
            refreshToken: encryptSecret(account.refreshToken) || account.refreshToken,
            userId, // Bind to the importing user
            proxy: encryptSecret(proxy) || undefined,
            minDelay: minDelay !== undefined ? parseInt(minDelay, 10) : undefined,
            maxDelay: maxDelay !== undefined ? parseInt(maxDelay, 10) : undefined,
            dailyLimit: dailyLimit !== undefined ? parseInt(dailyLimit, 10) : undefined,
            status: 'ACTIVE',
            statusMessage: 'Imported / Updated successfully',
          },
          create: {
            email: account.email,
            password: encryptSecret(account.password),
            clientId: account.clientId,
            refreshToken: encryptSecret(account.refreshToken) || account.refreshToken,
            userId,
            proxy: encryptSecret(proxy),
            minDelay: minDelay !== undefined ? parseInt(minDelay, 10) : 5,
            maxDelay: maxDelay !== undefined ? parseInt(maxDelay, 10) : 15,
            dailyLimit: dailyLimit !== undefined ? parseInt(dailyLimit, 10) : 50,
            status: 'ACTIVE',
            statusMessage: 'Imported successfully',
          },
        });
        results.push(record);
      }

      res.status(200).json({
        success: true,
        message: `成功导入/更新 ${results.length} 个微软邮箱账号。`,
        count: results.length,
        accounts: results.map((r) => ({ id: r.id, email: r.email, status: r.status })),
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (e) {
      logger.error('EmailController: Import error', e);
      res
        .status(500)
        .json({ error: '数据库导入失败', details: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Fetches all Microsoft email accounts linked to the user
   */
  public static async getAccounts(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    try {
      const accounts = await prisma.microsoftEmailAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      res.status(200).json(accounts.map(toPublicEmailAccount));
    } catch (e) {
      res
        .status(500)
        .json({ error: '获取账号列表失败', details: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Deletes a Microsoft email account
   */
  public static async deleteAccount(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        res.status(404).json({ error: '未找到指定账号，或无权删除该账号' });
        return;
      }

      await prisma.microsoftEmailAccount.delete({
        where: { id },
      });

      res.status(200).json({ success: true, message: '账号已成功从系统中移除' });
    } catch (e) {
      res
        .status(500)
        .json({ error: '删除账号失败', details: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Triggers a manual connection test to Microsoft Graph API
   */
  public static async testAccount(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        res.status(404).json({ error: '未找到指定账号' });
        return;
      }

      const profile = await MicrosoftGraphService.testConnection(id);
      res.status(200).json({
        success: true,
        message: '连接测试成功，账号状态良好',
        profile,
      });
    } catch (e) {
      res
        .status(500)
        .json({ error: '连接微软服务失败', details: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Fetches the email folders for a specific account
   */
  public static async getFolders(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        res.status(404).json({ error: '账号不存在' });
        return;
      }

      const folders = await MicrosoftGraphService.fetchFolders(id);
      res.status(200).json(folders);
    } catch (e) {
      res
        .status(500)
        .json({ error: '获取文件夹列表失败', details: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Fetches messages within a specific folder of a Microsoft account
   */
  public static async getMessages(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const { folderId, limit } = req.query;

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        res.status(404).json({ error: '账号不存在' });
        return;
      }

      const parsedLimit = limit ? parseInt(limit as string, 10) : 25;
      const messages = await MicrosoftGraphService.fetchMessages(
        id,
        (folderId as string) || 'inbox',
        parsedLimit,
      );
      res.status(200).json(messages);
    } catch (e) {
      res
        .status(500)
        .json({ error: '获取邮件列表失败', details: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Marks a message as read or unread
   */
  public static async markMessageRead(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const messageId = req.params.messageId as string;
    const { isRead } = req.body;

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        res.status(404).json({ error: '账号不存在' });
        return;
      }

      await MicrosoftGraphService.markMessageRead(id, messageId, isRead);
      res.status(200).json({ success: true });
    } catch (e) {
      res.status(500).json({
        error: '更新邮件阅读状态失败',
        details: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Deletes a message from Microsoft Mail server
   */
  public static async deleteMessage(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const messageId = req.params.messageId as string;

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        res.status(404).json({ error: '账号不存在' });
        return;
      }

      await MicrosoftGraphService.deleteMessage(id, messageId);
      res.status(200).json({ success: true, message: '邮件已成功删除' });
    } catch (e) {
      res
        .status(500)
        .json({ error: '删除邮件失败', details: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Sends an email from a single account, or using a round-robin strategy
   */
  public static async sendEmail(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const { accountId, to, subject, content } = req.body;

    if (!to || !subject || !content) {
      res.status(400).json({ error: '收件人、主题及邮件正文内容不能为空' });
      return;
    }

    try {
      let selectedAccountId = accountId;

      if (accountId === 'round-robin') {
        // Spreads outbound sends evenly: choose the ACTIVE account with the fewest sends today
        const activeAccounts = await prisma.microsoftEmailAccount.findMany({
          where: { userId, status: 'ACTIVE' },
        });

        if (activeAccounts.length === 0) {
          res.status(400).json({ error: '当前无可用且已激活的微软邮箱账号，请先导入并进行测试' });
          return;
        }

        // Filter out those that hit their limits
        const eligibleAccounts = activeAccounts.filter(
          (acc) => acc.sentCountToday < acc.dailyLimit,
        );
        if (eligibleAccounts.length === 0) {
          res
            .status(400)
            .json({ error: '所有可用账号已达到每日发送限额，请调整每日限额或明日再试' });
          return;
        }

        // Select the one with the lowest sent count today
        eligibleAccounts.sort((a, b) => a.sentCountToday - b.sentCountToday);
        const targetAccount = eligibleAccounts[0];
        if (!targetAccount) {
          res.status(400).json({ error: '未找到符合发送条件的账号' });
          return;
        }
        selectedAccountId = targetAccount.id;
      } else {
        // Individual account validation
        const account = await prisma.microsoftEmailAccount.findFirst({
          where: { id: accountId, userId },
        });

        if (!account) {
          res.status(404).json({ error: '未找到选定的发送账号' });
          return;
        }

        if (account.status !== 'ACTIVE') {
          res
            .status(400)
            .json({ error: `选定的账号状态非激活 (${account.status})，请重新测试连接` });
          return;
        }

        if (account.sentCountToday >= account.dailyLimit) {
          res.status(400).json({ error: `选定的账号已达到每日发送限额 (${account.dailyLimit}封)` });
          return;
        }
      }

      // Fetch the selected account to read safe delay configurations
      const sendingAccount = await prisma.microsoftEmailAccount.findUnique({
        where: { id: selectedAccountId },
      });

      if (!sendingAccount) {
        res.status(500).json({ error: '选定发送账号获取失败' });
        return;
      }

      // Execute send via Graph API Service
      await MicrosoftGraphService.sendMail(selectedAccountId, { to, subject, content });

      // Calculate safe next delays response metadata for the frontend
      const randomDelaySec =
        Math.floor(Math.random() * (sendingAccount.maxDelay - sendingAccount.minDelay + 1)) +
        sendingAccount.minDelay;

      res.status(200).json({
        success: true,
        message: '邮件发送成功！',
        sender: sendingAccount.email,
        delayAdviceSeconds: randomDelaySec,
      });
    } catch (e) {
      logger.error('EmailController: Send error', e);
      res
        .status(500)
        .json({ error: '邮件发送失败', details: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Updates credentials or configurations of a Microsoft Email Account
   */
  public static async updateAccount(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const { password, clientId, refreshToken, proxy, dailyLimit, minDelay, maxDelay } = req.body;

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        res.status(404).json({ error: '账号不存在' });
        return;
      }

      const updateData: any = {};
      if (password !== undefined) {
        updateData.password = password ? encryptSecret(password) : null;
      }
      if (clientId !== undefined) {
        updateData.clientId = clientId;
      }
      if (refreshToken !== undefined) {
        updateData.refreshToken = encryptSecret(refreshToken) || refreshToken;
        // Reset status to ACTIVE to clear error state for user to test connection
        updateData.status = 'ACTIVE';
        updateData.statusMessage = 'Credentials updated';
      }
      if (proxy !== undefined) {
        updateData.proxy = proxy ? encryptSecret(proxy) : null;
      }
      if (dailyLimit !== undefined) {
        updateData.dailyLimit = parseInt(dailyLimit, 10);
      }
      if (minDelay !== undefined) {
        updateData.minDelay = parseInt(minDelay, 10);
      }
      if (maxDelay !== undefined) {
        updateData.maxDelay = parseInt(maxDelay, 10);
      }

      const updated = await prisma.microsoftEmailAccount.update({
        where: { id },
        data: updateData,
      });

      res.status(200).json({
        success: true,
        message: '账号更新成功',
        account: {
          id: updated.id,
          email: updated.email,
          status: updated.status,
        },
      });
    } catch (e) {
      logger.error('EmailController: Update error', e);
      res.status(500).json({
        error: '更新账号失败',
        details: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
