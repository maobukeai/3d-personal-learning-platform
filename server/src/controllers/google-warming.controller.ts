import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../services/prisma';
import { callLLM } from '../services/ai.service';
import { logger } from '../utils/logger';
import { encryptSecret, decryptSecret } from '../utils/secret-field';
import type { GoogleWarmingAccount } from '@prisma/client';

/**
 * Decrypts sensitive fields before returning account data to the client.
 * Plaintext values (existing unencrypted rows) are returned as-is by decryptSecret.
 *
 * Security note: This is a password-manager-style feature where users manage
 * THEIR OWN Google account credentials. All queries are scoped by `userId`
 * (see `where: { userId }`), so secrets are only ever returned to the owner.
 * Do NOT log the output of this function.
 */
const toPublicAccount = (account: GoogleWarmingAccount) => ({
  ...account,
  password: decryptSecret(account.password) ?? '',
  twoFASecret: decryptSecret(account.twoFASecret),
  backupCodes: decryptSecret(account.backupCodes),
});

export class GoogleWarmingController {
  /**
   * Get all Google warming accounts for the logged-in user
   */
  public static async getAccounts(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    try {
      const accounts = await prisma.googleWarmingAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      res.json(accounts.map(toPublicAccount));
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.getAccounts] error:', e);
      next(e);
    }
  }

  /**
   * Bulk imports Google accounts
   */
  public static async importAccounts(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
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
            password: encryptSecret((account.password || '').trim()) ?? '',
            recoveryEmail: account.recoveryEmail ? account.recoveryEmail.trim() : null,
            twoFASecret: account.twoFASecret ? encryptSecret(account.twoFASecret.trim()) : null,
            country: account.country ? account.country.trim() : null,
            note: account.note ? account.note.trim() : null,
            backupCodes: account.backupCodes ? encryptSecret(account.backupCodes.trim()) : null,
            category: account.category ? account.category.trim() : '未分类',
            status: account.status || 'warming',
            currentDay: Number(account.currentDay) || 1,
          },
        });
        imported.push(toPublicAccount(created));
      }
      res.json({ success: true, count: imported.length, accounts: imported });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.importAccounts] error:', e);
      next(e);
    }
  }

  /**
   * Parses raw account text using AI LLM
   */
  public static async aiParse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { text, translateCountry } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: '请提供待解析的文本内容' });
      return;
    }

    const countryInstruction =
      translateCountry !== false
        ? '- country: The country or region associated with the account (if present). You MUST translate this country/region name into Chinese (e.g., "US" or "United States" -> "美国", "HK" or "Hong Kong" -> "中国香港", "TW" or "Taiwan" -> "中国台湾", "SG" or "Singapore" -> "新加坡", "JP" or "Japan" -> "日本", etc.).'
        : '- country: The country or region associated with the account (if present).';

    const systemPrompt = `You are a professional Google account data parsing assistant.
Your task is to parse a list of Google accounts from unstructured or semi-structured text.
For each account, extract the following fields:
- email: The primary Gmail address or Google account username (required).
- password: The password for the account.
- recoveryEmail: The recovery/auxiliary/recovery email address (if present).
- twoFASecret: The 2FA secret key/code used for generating two-factor authentication tokens (if present, e.g. a string of 16-32 characters, sometimes with spaces).
${countryInstruction}
- backupCodes: Google account 2FA backup codes/passwords (if present). Google backup codes are typically a set of multiple 8-digit numbers (often 10 codes in total, e.g. "3191 6344", "6829 7625", etc., and they might span multiple lines). Format them as a single space-separated string of 8-digit codes.
- category: A category or group label (if present, e.g. "GCP", "AdSense", "Normal").
- note: Any additional labels, tags, or notes.

Respond ONLY with a valid JSON array of objects. Do NOT wrap the JSON in markdown code blocks, do NOT write any introductory or concluding text, and do NOT explain the output.
Format:
[
  {
    "email": "...",
    "password": "...",
    "recoveryEmail": "...",
    "twoFASecret": "...",
    "country": "...",
    "backupCodes": "...",
    "category": "...",
    "note": "..."
  }
]
If any field is missing or not found, set it to null.`;

    try {
      const responseText = await callLLM(text, systemPrompt);
      let cleaned = responseText.trim();

      // Clean potential markdown blocks
      if (cleaned.startsWith('```')) {
        cleaned = cleaned
          .replace(/^```json\s*/i, '')
          .replace(/```$/, '')
          .trim();
      }

      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) {
        throw new Error('AI 返回的不是一个 JSON 数组');
      }

      res.json({ success: true, accounts: parsed });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.aiParse] error:', e);
      next(e);
    }
  }

  /**
   * Updates a single account details
   */
  public static async updateAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const {
      email,
      password,
      recoveryEmail,
      twoFASecret,
      country,
      note,
      backupCodes,
      category,
      status,
      currentDay,
    } = req.body;

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
          password:
            password !== undefined ? (encryptSecret(password.trim()) ?? '') : existing.password,
          recoveryEmail:
            recoveryEmail !== undefined
              ? recoveryEmail
                ? recoveryEmail.trim()
                : null
              : existing.recoveryEmail,
          twoFASecret:
            twoFASecret !== undefined
              ? twoFASecret
                ? encryptSecret(twoFASecret.trim())
                : null
              : existing.twoFASecret,
          country: country !== undefined ? (country ? country.trim() : null) : existing.country,
          note: note !== undefined ? (note ? note.trim() : null) : existing.note,
          backupCodes:
            backupCodes !== undefined
              ? backupCodes
                ? encryptSecret(backupCodes.trim())
                : null
              : existing.backupCodes,
          category:
            category !== undefined ? (category ? category.trim() : '未分类') : existing.category,
          status: status !== undefined ? status : existing.status,
          currentDay: currentDay !== undefined ? Number(currentDay) : existing.currentDay,
        },
      });

      res.json(toPublicAccount(updated));
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.updateAccount] error:', e);
      next(e);
    }
  }

  /**
   * Completes the current day's warming task
   */
  public static async warmAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
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

      const nextDay = Math.min(account.currentDay + 1, 14);
      const newStatus = nextDay >= 14 ? 'completed' : account.status;

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
      next(e);
    }
  }

  /**
   * Deletes a warming account
   */
  public static async deleteAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
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
      next(e);
    }
  }

  /**
   * Batch check-in (warm) multiple accounts
   */
  public static async batchWarmAccounts(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
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
        const nextDay = Math.min(account.currentDay + 1, 14);
        const newStatus = nextDay >= 14 ? 'completed' : account.status;
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
      next(e);
    }
  }

  /**
   * Batch delete multiple accounts
   */
  public static async batchDeleteAccounts(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
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
      next(e);
    }
  }

  /**
   * Batch update status for multiple accounts
   */
  public static async batchStatusAccounts(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
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
      next(e);
    }
  }

  /**
   * Batch updates category for multiple accounts
   */
  public static async batchCategoryAccounts(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    const { ids, category } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: '请提供账号 ID 列表' });
      return;
    }

    try {
      const result = await prisma.googleWarmingAccount.updateMany({
        where: { id: { in: ids }, userId },
        data: { category: category || '未分类' },
      });

      res.json({ success: true, count: result.count });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.batchCategoryAccounts] error:', e);
      next(e);
    }
  }

  /**
   * Rename a category for all user's accounts
   */
  public static async renameCategory(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    const { oldCategory, newCategory } = req.body;

    if (!oldCategory) {
      res.status(400).json({ error: '请提供原分类名称' });
      return;
    }

    const targetCategory = newCategory ? newCategory.trim() : '未分类';

    try {
      // 1. Update accounts
      const result = await prisma.googleWarmingAccount.updateMany({
        where: { userId, category: oldCategory },
        data: { category: targetCategory },
      });

      // 2. Update user settings
      const current = await GoogleWarmingController.getUserCategories(userId);
      const updated = current
        .map((c) => (c === oldCategory ? targetCategory : c))
        .filter((c) => c !== '未分类');
      await GoogleWarmingController.saveUserCategories(userId, updated);

      res.json({ success: true, count: result.count });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.renameCategory] error:', e);
      next(e);
    }
  }

  /**
   * Delete a category (resets accounts to '未分类')
   */
  public static async deleteCategory(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    const { category } = req.body;

    if (!category) {
      res.status(400).json({ error: '请提供要删除的分类名称' });
      return;
    }

    try {
      // 1. Update accounts
      const result = await prisma.googleWarmingAccount.updateMany({
        where: { userId, category },
        data: { category: '未分类' },
      });

      // 2. Update user settings
      const current = await GoogleWarmingController.getUserCategories(userId);
      const updated = current.filter((c) => c !== category);
      await GoogleWarmingController.saveUserCategories(userId, updated);

      res.json({ success: true, count: result.count });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.deleteCategory] error:', e);
      next(e);
    }
  }

  /**
   * Get all categories saved in settings + actual database categories
   */
  public static async getCategories(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    try {
      const settingsCats = await GoogleWarmingController.getUserCategories(userId);

      const dbCatsResult = await prisma.googleWarmingAccount.findMany({
        where: { userId },
        select: { category: true },
        distinct: ['category'],
      });
      const dbCats = dbCatsResult
        .map((a) => a.category)
        .filter((c): c is string => !!c && c !== '未分类');

      const merged = Array.from(new Set([...settingsCats, ...dbCats]));

      if (merged.length !== settingsCats.length) {
        await GoogleWarmingController.saveUserCategories(userId, merged);
      }

      res.json({ success: true, categories: merged });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.getCategories] error:', e);
      next(e);
    }
  }

  /**
   * Add a new category to settings
   */
  public static async addCategory(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = req.userId as string;
    const { category } = req.body;

    if (!category || !category.trim()) {
      res.status(400).json({ error: '分类名称不能为空' });
      return;
    }

    const catName = category.trim();
    if (catName === '未分类' || catName === 'all') {
      res.status(400).json({ error: '无效的分类名称' });
      return;
    }

    try {
      const current = await GoogleWarmingController.getUserCategories(userId);
      if (current.includes(catName)) {
        res.status(400).json({ error: '分类已存在' });
        return;
      }

      current.push(catName);
      await GoogleWarmingController.saveUserCategories(userId, current);

      res.json({ success: true, categories: current });
    } catch (e: unknown) {
      logger.error('[GoogleWarmingController.addCategory] error:', e);
      next(e);
    }
  }

  // Helper methods for category settings
  private static async getUserCategories(userId: string): Promise<string[]> {
    const setting = await prisma.userSetting.findUnique({
      where: {
        userId_key: {
          userId,
          key: 'google_warming_categories',
        },
      },
    });
    if (!setting) return [];
    try {
      return JSON.parse(setting.value);
    } catch {
      return [];
    }
  }

  private static async saveUserCategories(userId: string, categories: string[]): Promise<void> {
    const uniqueCategories = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
    await prisma.userSetting.upsert({
      where: {
        userId_key: {
          userId,
          key: 'google_warming_categories',
        },
      },
      update: {
        value: JSON.stringify(uniqueCategories),
      },
      create: {
        userId,
        key: 'google_warming_categories',
        value: JSON.stringify(uniqueCategories),
      },
    });
  }
}
