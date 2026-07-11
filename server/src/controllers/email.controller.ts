import { logger } from '../utils/logger';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MicrosoftEmailAccount } from '@prisma/client';
import prisma from '../services/prisma';
import { MicrosoftGraphService } from '../services/microsoftGraph.service';
import { encryptSecret, decryptSecret, maskProxyUrl } from '../utils/secret-field';

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
  public static async importAccounts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { importData, proxy, minDelay, maxDelay, dailyLimit } = request.body as {
      importData?: string;
      proxy?: string;
      minDelay?: string | number;
      maxDelay?: string | number;
      dailyLimit?: string | number;
    };
    const userId = request.userId as string;

    if (!importData || typeof importData !== 'string') {
      reply.status(400).send({ error: '请提供有效的导入数据内容' });
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

      let email: string;
      let password = '';
      let clientId: string;
      let token: string;

      if (parts.length === 2) {
        // Supported format for updating existing accounts: email----new_refresh_token
        email = parts[0] || '';
        token = parts[1] || '';

        // Query DB for existing clientId
        const existing = await prisma.microsoftEmailAccount.findUnique({
          where: { email },
          select: { clientId: true, password: true, userId: true },
        });

        if (existing) {
          if (existing.userId !== userId) {
            errors.push(`第 ${i + 1} 行：邮箱 ${email} 归属于其他用户，无权更新`);
            continue;
          }
          clientId = existing.clientId;
          password = existing.password ? decryptSecret(existing.password) || '' : '';
        } else {
          errors.push(
            `第 ${i + 1} 行：账号 ${email} 在系统中不存在。首次导入账号需要提供 Client ID，请使用完整格式：邮箱----密码----client_id----令牌`,
          );
          continue;
        }
      } else if (parts.length === 3) {
        // Format: email----client_id----refresh_token
        email = parts[0] || '';
        clientId = parts[1] || '';
        token = parts[2] || '';
      } else if (parts.length >= 4) {
        // Format: email----password----client_id----refresh_token
        email = parts[0] || '';
        password = parts[1] || '';
        clientId = parts[2] || '';
        token = parts[3] || '';
      } else {
        errors.push(
          `第 ${i + 1} 行格式不正确，缺少字段。要求格式: 邮箱----密码----client_id----令牌`,
        );
        continue;
      }

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
      reply.status(400).send({ error: '解析失败，未找到有效的账号记录', details: errors });
      return;
    }

    try {
      const results = [];
      // Single round-trip ownership pre-check for all emails at once (avoids
      // one findUnique per parsed account — N+1).
      const existingAccounts = await prisma.microsoftEmailAccount.findMany({
        where: { email: { in: parsedAccounts.map((a) => a.email) } },
        select: { email: true, userId: true },
      });
      const existingByOwner = new Map(existingAccounts.map((a) => [a.email, a.userId]));

      for (const account of parsedAccounts) {
        const ownerUserId = existingByOwner.get(account.email);
        if (ownerUserId !== undefined && ownerUserId !== userId) {
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
            minDelay: minDelay !== undefined ? parseInt(String(minDelay), 10) : undefined,
            maxDelay: maxDelay !== undefined ? parseInt(String(maxDelay), 10) : undefined,
            dailyLimit: dailyLimit !== undefined ? parseInt(String(dailyLimit), 10) : undefined,
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
            minDelay: minDelay !== undefined ? parseInt(String(minDelay), 10) : 5,
            maxDelay: maxDelay !== undefined ? parseInt(String(maxDelay), 10) : 15,
            dailyLimit: dailyLimit !== undefined ? parseInt(String(dailyLimit), 10) : 50,
            status: 'ACTIVE',
            statusMessage: 'Imported successfully',
          },
        });
        results.push(record);
      }

      reply.status(200).send({
        success: true,
        message: `成功导入/更新 ${results.length} 个微软邮箱账号。`,
        count: results.length,
        accounts: results.map((r) => ({ id: r.id, email: r.email, status: r.status })),
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (e) {
      logger.error('EmailController: Import error', e);
      throw e;
    }
  }

  /**
   * Fetches all Microsoft email accounts linked to the user
   */
  public static async getAccounts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    try {
      const accounts = await prisma.microsoftEmailAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      reply.status(200).send(accounts.map(toPublicEmailAccount));
    } catch (e) {
      throw e;
    }
  }

  /**
   * Deletes a Microsoft email account
   */
  public static async deleteAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const id = (request.params as { id: string }).id;

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        reply.status(404).send({ error: '未找到指定账号，或无权删除该账号' });
        return;
      }

      await prisma.microsoftEmailAccount.delete({
        where: { id },
      });

      reply.status(200).send({ success: true, message: '账号已成功从系统中移除' });
    } catch (e) {
      throw e;
    }
  }

  /**
   * Triggers a manual connection test to Microsoft Graph API
   */
  public static async testAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const id = (request.params as { id: string }).id;

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        reply.status(404).send({ error: '未找到指定账号' });
        return;
      }

      const profile = await MicrosoftGraphService.testConnection(id);
      reply.status(200).send({
        success: true,
        message: '连接测试成功，账号状态良好',
        profile,
      });
    } catch (e) {
      throw e;
    }
  }

  /**
   * Fetches the email folders for a specific account
   */
  public static async getFolders(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const id = (request.params as { id: string }).id;

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        reply.status(404).send({ error: '账号不存在' });
        return;
      }

      const folders = await MicrosoftGraphService.fetchFolders(id);
      reply.status(200).send(folders);
    } catch (e) {
      throw e;
    }
  }

  /**
   * Fetches messages within a specific folder of a Microsoft account
   */
  public static async getMessages(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const id = (request.params as { id: string }).id;
    const { folderId, limit } = request.query as { folderId?: string; limit?: string };

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        reply.status(404).send({ error: '账号不存在' });
        return;
      }

      const parsedLimit = limit ? parseInt(limit as string, 10) : 25;
      const messages = await MicrosoftGraphService.fetchMessages(
        id,
        folderId || 'inbox',
        parsedLimit,
      );
      reply.status(200).send(messages);
    } catch (e) {
      throw e;
    }
  }

  /**
   * Marks a message as read or unread
   */
  public static async markMessageRead(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const { id, messageId } = request.params as { id: string; messageId: string };
    const { isRead } = request.body as { isRead: boolean };

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        reply.status(404).send({ error: '账号不存在' });
        return;
      }

      await MicrosoftGraphService.markMessageRead(id, messageId, isRead);
      reply.status(200).send({ success: true });
    } catch (e) {
      throw e;
    }
  }

  /**
   * Deletes a message from Microsoft Mail server
   */
  public static async deleteMessage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const { id, messageId } = request.params as { id: string; messageId: string };

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        reply.status(404).send({ error: '账号不存在' });
        return;
      }

      await MicrosoftGraphService.deleteMessage(id, messageId);
      reply.status(200).send({ success: true, message: '邮件已成功删除' });
    } catch (e) {
      throw e;
    }
  }

  /**
   * Sends an email from a single account, or using a round-robin strategy
   */
  public static async sendEmail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const { accountId, to, subject, content } = request.body as {
      accountId: string;
      to: string;
      subject: string;
      content: string;
    };

    if (!to || !subject || !content) {
      reply.status(400).send({ error: '收件人、主题及邮件正文内容不能为空' });
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
          reply.status(400).send({ error: '当前无可用且已激活的微软邮箱账号，请先导入并进行测试' });
          return;
        }

        // Filter out those that hit their limits
        const eligibleAccounts = activeAccounts.filter(
          (acc) => acc.sentCountToday < acc.dailyLimit,
        );
        if (eligibleAccounts.length === 0) {
          reply
            .status(400)
            .send({ error: '所有可用账号已达到每日发送限额，请调整每日限额或明日再试' });
          return;
        }

        // Select the one with the lowest sent count today
        eligibleAccounts.sort((a, b) => a.sentCountToday - b.sentCountToday);
        const targetAccount = eligibleAccounts[0];
        if (!targetAccount) {
          reply.status(400).send({ error: '未找到符合发送条件的账号' });
          return;
        }
        selectedAccountId = targetAccount.id;
      } else {
        // Individual account validation
        const account = await prisma.microsoftEmailAccount.findFirst({
          where: { id: accountId, userId },
        });

        if (!account) {
          reply.status(404).send({ error: '未找到选定的发送账号' });
          return;
        }

        if (account.status !== 'ACTIVE') {
          reply
            .status(400)
            .send({ error: `选定的账号状态非激活 (${account.status})，请重新测试连接` });
          return;
        }

        if (account.sentCountToday >= account.dailyLimit) {
          reply
            .status(400)
            .send({ error: `选定的账号已达到每日发送限额 (${account.dailyLimit}封)` });
          return;
        }
      }

      // Fetch the selected account to read safe delay configurations
      const sendingAccount = await prisma.microsoftEmailAccount.findUnique({
        where: { id: selectedAccountId },
      });

      if (!sendingAccount) {
        reply.status(500).send({ error: '选定发送账号获取失败' });
        return;
      }

      // Execute send via Graph API Service
      await MicrosoftGraphService.sendMail(selectedAccountId, { to, subject, content });

      // Calculate safe next delays response metadata for the frontend
      const randomDelaySec =
        Math.floor(Math.random() * (sendingAccount.maxDelay - sendingAccount.minDelay + 1)) +
        sendingAccount.minDelay;

      reply.status(200).send({
        success: true,
        message: '邮件发送成功！',
        sender: sendingAccount.email,
        delayAdviceSeconds: randomDelaySec,
      });
    } catch (e) {
      logger.error('EmailController: Send error', e);
      throw e;
    }
  }

  /**
   * Updates credentials or configurations of a Microsoft Email Account
   */
  public static async updateAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const id = (request.params as { id: string }).id;
    const { password, clientId, refreshToken, proxy, dailyLimit, minDelay, maxDelay } =
      request.body as {
        password?: string;
        clientId?: string;
        refreshToken?: string;
        proxy?: string;
        dailyLimit?: string | number;
        minDelay?: string | number;
        maxDelay?: string | number;
      };

    try {
      const account = await prisma.microsoftEmailAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        reply.status(404).send({ error: '账号不存在' });
        return;
      }

      const updateData: {
        password?: string | null;
        clientId?: string;
        refreshToken?: string;
        status?: string;
        statusMessage?: string;
        proxy?: string | null;
        dailyLimit?: number;
        minDelay?: number;
        maxDelay?: number;
      } = {};
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
        updateData.dailyLimit = parseInt(String(dailyLimit), 10);
      }
      if (minDelay !== undefined) {
        updateData.minDelay = parseInt(String(minDelay), 10);
      }
      if (maxDelay !== undefined) {
        updateData.maxDelay = parseInt(String(maxDelay), 10);
      }

      const updated = await prisma.microsoftEmailAccount.update({
        where: { id },
        data: updateData,
      });

      reply.status(200).send({
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
      throw e;
    }
  }
}
