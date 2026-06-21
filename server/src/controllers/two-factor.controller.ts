import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../services/prisma';
import { logger } from '../utils/logger';

export class TwoFactorController {
  /**
   * Get all 2FA accounts for the logged-in user
   */
  public static async getAccounts(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    try {
      const accounts = await prisma.twoFactorAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      res.json(accounts);
    } catch (e: unknown) {
      logger.error('[TwoFactorController.getAccounts] error:', e);
      next(e);
    }
  }

  /**
   * Create a new 2FA account record
   */
  public static async createAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    const { label, email, secret, note, category } = req.body;

    if (!label || !label.trim()) {
      res.status(400).json({ error: '请提供账号名称/标签' });
      return;
    }

    if (!secret || !secret.trim()) {
      res.status(400).json({ error: '请提供2FA密钥' });
      return;
    }

    // Clean base32 secret: remove spaces and equal signs, convert to uppercase
    const cleanSecret = secret.replace(/[\s=]/g, '').toUpperCase();

    // Validate base32 format
    const base32Regex = /^[A-Z2-7]+$/;
    if (!base32Regex.test(cleanSecret)) {
      res.status(400).json({ error: '无效的2FA密钥格式，必须是Base32字符（A-Z, 2-7）' });
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
      res.status(201).json(newAccount);
    } catch (e: unknown) {
      logger.error('[TwoFactorController.createAccount] error:', e);
      next(e);
    }
  }

  /**
   * Update an existing 2FA account's details
   */
  public static async updateAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const { label, email, note, category } = req.body;

    if (!label || !label.trim()) {
      res.status(400).json({ error: '账号名称/标签不能为空' });
      return;
    }

    try {
      // Verify ownership
      const account = await prisma.twoFactorAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        res.status(404).json({ error: '找不到该2FA记录或无操作权限' });
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

      res.json(updated);
    } catch (e: unknown) {
      logger.error('[TwoFactorController.updateAccount] error:', e);
      next(e);
    }
  }

  /**
   * Delete a 2FA account record
   */
  public static async deleteAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;

    try {
      // Verify ownership
      const account = await prisma.twoFactorAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        res.status(404).json({ error: '找不到该2FA记录或无操作权限' });
        return;
      }

      await prisma.twoFactorAccount.delete({
        where: { id },
      });

      res.json({ message: '2FA账号删除成功' });
    } catch (e: unknown) {
      logger.error('[TwoFactorController.deleteAccount] error:', e);
      next(e);
    }
  }

  /**
   * Bulk import 2FA accounts
   */
  public static async importAccounts(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    const { accounts } = req.body;

    if (!accounts || !Array.isArray(accounts)) {
      res.status(400).json({ error: '无效的导入数据' });
      return;
    }

    try {
      const imported = [];
      for (const account of accounts) {
        if (!account.label || !account.secret) continue;

        const cleanSecret = account.secret.replace(/[\s=]/g, '').toUpperCase();
        const base32Regex = /^[A-Z2-7]+$/;
        if (!base32Regex.test(cleanSecret)) continue; // skip invalid records

        const created = await prisma.twoFactorAccount.create({
          data: {
            userId,
            label: account.label.trim(),
            email: account.email ? account.email.trim() : null,
            secret: cleanSecret,
            note: account.note ? account.note.trim() : null,
            category: account.category ? account.category.trim() : null,
          },
        });
        imported.push(created);
      }
      res.json({ success: true, count: imported.length, accounts: imported });
    } catch (e: unknown) {
      logger.error('[TwoFactorController.importAccounts] error:', e);
      next(e);
    }
  }
}
