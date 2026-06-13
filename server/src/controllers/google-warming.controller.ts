import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../services/prisma';
import { callLLM } from '../services/ai.service';
import { logger } from '../utils/logger';

export class GoogleWarmingController {
  /**
   * Get all Google warming accounts for the logged-in user
   */
  public static async getAccounts(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    try {
      const accounts = await prisma.googleWarmingAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      res.json(accounts);
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.getAccounts] error:', e);
      res.status(500).json({ error: '获取账号列表失败' });
    }
  }

  /**
   * Bulk imports Google accounts
   */
  public static async importAccounts(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const { accounts } = req.body;

    if (!accounts || !Array.isArray(accounts)) {
      res.status(400).json({ error: '无效的账号数据，请提供账号数组' });
      return;
    }

    try {
      const imported = [];
      for (const account of accounts) {
        if (!account.email) continue;
        const created = await prisma.googleWarmingAccount.create({
          data: {
            userId,
            email: account.email.trim(),
            password: (account.password || '').trim(),
            recoveryEmail: account.recoveryEmail ? account.recoveryEmail.trim() : null,
            twoFASecret: account.twoFASecret ? account.twoFASecret.trim() : null,
            country: account.country ? account.country.trim() : null,
            note: account.note ? account.note.trim() : null,
            status: 'warming',
            currentDay: Number(account.currentDay) || 1,
          },
        });
        imported.push(created);
      }
      res.json({ success: true, count: imported.length, accounts: imported });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.importAccounts] error:', e);
      res.status(500).json({ error: '批量导入账号失败' });
    }
  }

  /**
   * Parses raw account text using AI LLM
   */
  public static async aiParse(req: AuthRequest, res: Response): Promise<void> {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: '请提供待解析的文本内容' });
      return;
    }

    const systemPrompt = `You are a professional Google account data parsing assistant.
Your task is to parse a list of Google accounts from unstructured or semi-structured text.
For each account, extract the following fields:
- email: The primary Gmail address or Google account username (required).
- password: The password for the account.
- recoveryEmail: The recovery/auxiliary/recovery email address (if present).
- twoFASecret: The 2FA secret key/code used for generating two-factor authentication tokens (if present, e.g. a string of 16-32 characters, sometimes with spaces).
- country: The country or region associated with the account (if present).
- note: Any additional labels, tags, categories, or notes (e.g. "gcp").

Respond ONLY with a valid JSON array of objects. Do NOT wrap the JSON in markdown code blocks, do NOT write any introductory or concluding text, and do NOT explain the output.
Format:
[
  {
    "email": "...",
    "password": "...",
    "recoveryEmail": "...",
    "twoFASecret": "...",
    "country": "...",
    "note": "..."
  }
]
If any field is missing or not found, set it to null.`;

    try {
      const responseText = await callLLM(text, systemPrompt);
      let cleaned = responseText.trim();
      
      // Clean potential markdown blocks
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) {
        throw new Error('AI 返回的不是一个 JSON 数组');
      }

      res.json({ success: true, accounts: parsed });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.aiParse] error:', e);
      res.status(500).json({ error: 'AI 解析失败，请检查文本格式或重试', details: String(e) });
    }
  }

  /**
   * Updates a single account details
   */
  public static async updateAccount(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const { email, password, recoveryEmail, twoFASecret, country, note, status, currentDay } = req.body;

    try {
      const existing = await prisma.googleWarmingAccount.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        res.status(404).json({ error: '未找到该账号' });
        return;
      }

      const updated = await prisma.googleWarmingAccount.update({
        where: { id },
        data: {
          email: email !== undefined ? email.trim() : existing.email,
          password: password !== undefined ? password.trim() : existing.password,
          recoveryEmail: recoveryEmail !== undefined ? (recoveryEmail ? recoveryEmail.trim() : null) : existing.recoveryEmail,
          twoFASecret: twoFASecret !== undefined ? (twoFASecret ? twoFASecret.trim() : null) : existing.twoFASecret,
          country: country !== undefined ? (country ? country.trim() : null) : existing.country,
          note: note !== undefined ? (note ? note.trim() : null) : existing.note,
          status: status !== undefined ? status : existing.status,
          currentDay: currentDay !== undefined ? Number(currentDay) : existing.currentDay,
        },
      });

      res.json(updated);
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.updateAccount] error:', e);
      res.status(500).json({ error: '更新账号失败' });
    }
  }

  /**
   * Completes the current day's warming task
   */
  public static async warmAccount(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;

    try {
      const account = await prisma.googleWarmingAccount.findFirst({
        where: { id, userId },
      });

      if (!account) {
        res.status(404).json({ error: '未找到该账号' });
        return;
      }

      const nextDay = Math.min(account.currentDay + 1, 15);
      const newStatus = nextDay >= 15 ? 'completed' : account.status;

      const updated = await prisma.googleWarmingAccount.update({
        where: { id },
        data: {
          currentDay: nextDay,
          lastWarmedAt: new Date(),
          status: newStatus,
        },
      });

      res.json(updated);
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.warmAccount] error:', e);
      res.status(500).json({ error: '更新养号状态失败' });
    }
  }

  /**
   * Deletes a warming account
   */
  public static async deleteAccount(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;

    try {
      const existing = await prisma.googleWarmingAccount.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        res.status(404).json({ error: '未找到该账号' });
        return;
      }

      await prisma.googleWarmingAccount.delete({
        where: { id },
      });

      res.json({ success: true });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.deleteAccount] error:', e);
      res.status(500).json({ error: '删除账号失败' });
    }
  }

  /**
   * Batch check-in (warm) multiple accounts
   */
  public static async batchWarmAccounts(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: '请提供要打卡的账号 ID 列表' });
      return;
    }

    try {
      const accounts = await prisma.googleWarmingAccount.findMany({
        where: { id: { in: ids }, userId },
      });

      if (accounts.length === 0) {
        res.status(404).json({ error: '未找到符合条件的账号' });
        return;
      }

      const updates = accounts.map((account) => {
        const nextDay = Math.min(account.currentDay + 1, 15);
        const newStatus = nextDay >= 15 ? 'completed' : account.status;
        return prisma.googleWarmingAccount.update({
          where: { id: account.id },
          data: {
            currentDay: nextDay,
            lastWarmedAt: new Date(),
            status: newStatus,
          },
        });
      });

      const results = await prisma.$transaction(updates);
      res.json({ success: true, count: results.length, accounts: results });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.batchWarmAccounts] error:', e);
      res.status(500).json({ error: '批量打卡失败' });
    }
  }

  /**
   * Batch delete multiple accounts
   */
  public static async batchDeleteAccounts(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: '请提供要删除的账号 ID 列表' });
      return;
    }

    try {
      const result = await prisma.googleWarmingAccount.deleteMany({
        where: { id: { in: ids }, userId },
      });

      res.json({ success: true, count: result.count });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.batchDeleteAccounts] error:', e);
      res.status(500).json({ error: '批量删除账号失败' });
    }
  }

  /**
   * Batch update status for multiple accounts
   */
  public static async batchStatusAccounts(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId as string;
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: '请提供账号 ID 列表' });
      return;
    }

    if (!status || !['warming', 'completed', 'paused'].includes(status)) {
      res.status(400).json({ error: '无效的状态值' });
      return;
    }

    try {
      const result = await prisma.googleWarmingAccount.updateMany({
        where: { id: { in: ids }, userId },
        data: { status },
      });

      res.json({ success: true, count: result.count });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.batchStatusAccounts] error:', e);
      res.status(500).json({ error: '批量修改状态失败' });
    }
  }
}
