import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../services/prisma';
import { logger } from '../utils/logger';

export class TwoFactorController {
  /**
   * Get all 2FA accounts for the logged-in user
   */
  public static async getAccounts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    try {
      const accounts = await prisma.twoFactorAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      reply.send(accounts);
    } catch (e: unknown) {
      logger.error('[TwoFactorController.getAccounts] error:', e);
      throw e;
    }
  }

  /**
   * Create a new 2FA account record
   */
  public static async createAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const { label, email, secret, note, category } = request.body as {
      label?: string;
      email?: string;
      secret?: string;
      note?: string;
      category?: string;
    };

    if (!label || !label.trim()) {
      reply.status(400).send({ error: '请提供账号名称/标签' });
      return;
    }

    if (!secret || !secret.trim()) {
      reply.status(400).send({ error: '请提供2FA密钥' });
      return;
    }

    // Clean base32 secret: remove spaces and equal signs, convert to uppercase
    const cleanSecret = secret.replace(/[\s=]/g, '').toUpperCase();

    // Validate base32 format
    const base32Regex = /^[A-Z2-7]+$/;
    if (!base32Regex.test(cleanSecret)) {
      reply.status(400).send({ error: '无效的2FA密钥格式，必须是Base32字符（A-Z, 2-7）' });
      return;
    }

    try {
      const newAccount = await prisma.twoFactorAccount.create({
        data: {
          userId,
          label: label.trim(),
          email: email ? email.trim() : null,
          secret: cleanSecret,
          note: note ? note.trim() : null,
          category: category ? category.trim() : null,
        },
      });
      reply.status(201).send(newAccount);
    } catch (e: unknown) {
      logger.error('[TwoFactorController.createAccount] error:', e);
      throw e;
    }
  }

  /**
   * Update an existing 2FA account's details
   */
  public static async updateAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const id = (request.params as { id: string }).id;
    const { label, email, note, category } = request.body as {
      label?: string;
      email?: string;
      note?: string;
      category?: string;
    };

    if (!label || !label.trim()) {
      reply.status(400).send({ error: '账号名称/标签不能为空' });
      return;
    }

    try {
      // Verify ownership
      const account = await prisma.twoFactorAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        reply.status(404).send({ error: '找不到该2FA记录或无操作权限' });
        return;
      }

      const updated = await prisma.twoFactorAccount.update({
        where: { id },
        data: {
          label: label.trim(),
          email: email ? email.trim() : null,
          note: note ? note.trim() : null,
          category: category ? category.trim() : null,
        },
      });

      reply.send(updated);
    } catch (e: unknown) {
      logger.error('[TwoFactorController.updateAccount] error:', e);
      throw e;
    }
  }

  /**
   * Delete a 2FA account record
   */
  public static async deleteAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const id = (request.params as { id: string }).id;

    try {
      // Verify ownership
      const account = await prisma.twoFactorAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        reply.status(404).send({ error: '找不到该2FA记录或无操作权限' });
        return;
      }

      await prisma.twoFactorAccount.delete({
        where: { id },
      });

      reply.send({ message: '2FA账号删除成功' });
    } catch (e: unknown) {
      logger.error('[TwoFactorController.deleteAccount] error:', e);
      throw e;
    }
  }

  /**
   * Bulk import 2FA accounts
   */
  public static async importAccounts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId as string;
    const { accounts } = request.body as { accounts?: unknown[] };

    if (!accounts || !Array.isArray(accounts)) {
      reply.status(400).send({ error: '无效的导入数据' });
      return;
    }

    try {
      const imported = [];
      for (const account of accounts) {
        const acc = account as {
          label?: string;
          secret?: string;
          email?: string;
          note?: string;
          category?: string;
        };
        if (!acc.label || !acc.secret) continue;

        const cleanSecret = acc.secret.replace(/[\s=]/g, '').toUpperCase();
        const base32Regex = /^[A-Z2-7]+$/;
        if (!base32Regex.test(cleanSecret)) continue; // skip invalid records

        const created = await prisma.twoFactorAccount.create({
          data: {
            userId,
            label: acc.label.trim(),
            email: acc.email ? acc.email.trim() : null,
            secret: cleanSecret,
            note: acc.note ? acc.note.trim() : null,
            category: acc.category ? acc.category.trim() : null,
          },
        });
        imported.push(created);
      }
      reply.send({ success: true, count: imported.length, accounts: imported });
    } catch (e: unknown) {
      logger.error('[TwoFactorController.importAccounts] error:', e);
      throw e;
    }
  }
}
