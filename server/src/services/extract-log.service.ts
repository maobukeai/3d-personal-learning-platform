import prisma from './prisma';
import { logger } from '../utils/logger';

export interface RecordExtractParams {
  userId: string;
  resourceId: string;
  resourceTitle: string;
  resourceType?: string;
  sourceId?: string;
  sourceName?: string;
  driveName?: string;
  driveLink?: string;
  drivePassword?: string;
  thumbnailUrl?: string;
}

export interface UserExtractLogItem {
  id: string;
  userId: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  sourceId: string | null;
  sourceName: string | null;
  driveName: string | null;
  driveLink: string | null;
  drivePassword: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

class ExtractLogService {
  private isTableInitialized = false;

  private async ensureTable(): Promise<void> {
    if (this.isTableInitialized) return;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`ResourceExtractLog\` (
          \`id\` VARCHAR(191) NOT NULL,
          \`userId\` VARCHAR(191) NOT NULL,
          \`resourceId\` VARCHAR(191) NOT NULL,
          \`resourceTitle\` VARCHAR(255) NOT NULL,
          \`resourceType\` VARCHAR(50) NOT NULL DEFAULT 'MIRROR',
          \`sourceId\` VARCHAR(191) NULL,
          \`sourceName\` VARCHAR(255) NULL,
          \`driveName\` VARCHAR(100) NULL,
          \`driveLink\` TEXT NULL,
          \`drivePassword\` VARCHAR(100) NULL,
          \`thumbnailUrl\` TEXT NULL,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (\`id\`),
          INDEX \`ResourceExtractLog_userId_createdAt_idx\` (\`userId\`, \`createdAt\`),
          INDEX \`ResourceExtractLog_resourceId_idx\` (\`resourceId\`)
        ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `);
      this.isTableInitialized = true;
    } catch (err: any) {
      logger.warn('[ExtractLogService] ensureTable failed or table exists:', err?.message);
      this.isTableInitialized = true;
    }
  }

  /**
   * 记录提取网盘信息（如果当天已提取同一资源，则更新最新密码与提取时间）
   */
  async recordExtract(params: RecordExtractParams): Promise<void> {
    await this.ensureTable();
    const id = 'ext_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    const now = new Date();

    try {
      // 检查最近是否有该资源的提取记录
      const existing = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM \`ResourceExtractLog\` WHERE \`userId\` = ? AND \`resourceId\` = ? LIMIT 1`,
        params.userId,
        params.resourceId,
      );

      if (existing && existing.length > 0) {
        // 更新现有记录
        await prisma.$executeRawUnsafe(
          `UPDATE \`ResourceExtractLog\` 
           SET \`resourceTitle\` = ?, \`driveName\` = ?, \`driveLink\` = ?, \`drivePassword\` = ?, \`thumbnailUrl\` = ?, \`updatedAt\` = ?, \`createdAt\` = ?
           WHERE \`id\` = ?`,
          params.resourceTitle,
          params.driveName || '资源网盘',
          params.driveLink || '',
          params.drivePassword || '',
          params.thumbnailUrl || '',
          now,
          now,
          existing[0].id,
        );
      } else {
        // 插入新记录
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`ResourceExtractLog\` (\`id\`, \`userId\`, \`resourceId\`, \`resourceTitle\`, \`resourceType\`, \`sourceId\`, \`sourceName\`, \`driveName\`, \`driveLink\`, \`drivePassword\`, \`thumbnailUrl\`, \`createdAt\`, \`updatedAt\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          params.userId,
          params.resourceId,
          params.resourceTitle,
          params.resourceType || 'MIRROR',
          params.sourceId || null,
          params.sourceName || null,
          params.driveName || '资源网盘',
          params.driveLink || '',
          params.drivePassword || '',
          params.thumbnailUrl || '',
          now,
          now,
        );
      }
    } catch (err: any) {
      logger.error('[ExtractLogService] recordExtract error:', err?.message);
    }
  }

  /**
   * 分页获取用户的提取历史
   */
  async getUserExtractLogs(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ list: UserExtractLogItem[]; total: number; page: number; pageSize: number }> {
    await this.ensureTable();
    const offset = Math.max(0, (page - 1) * pageSize);

    try {
      const countRes = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as count FROM \`ResourceExtractLog\` WHERE \`userId\` = ?`,
        userId,
      );
      const total = Number(countRes[0]?.count || 0);

      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM \`ResourceExtractLog\` 
         WHERE \`userId\` = ? 
         ORDER BY \`createdAt\` DESC 
         LIMIT ? OFFSET ?`,
        userId,
        pageSize,
        offset,
      );

      return {
        list: rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          resourceId: r.resourceId,
          resourceTitle: r.resourceTitle,
          resourceType: r.resourceType,
          sourceId: r.sourceId,
          sourceName: r.sourceName,
          driveName: r.driveName,
          driveLink: r.driveLink,
          drivePassword: r.drivePassword,
          thumbnailUrl: r.thumbnailUrl,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
          updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
        })),
        total,
        page,
        pageSize,
      };
    } catch (err: any) {
      logger.error('[ExtractLogService] getUserExtractLogs error:', err?.message);
      return { list: [], total: 0, page, pageSize };
    }
  }

  /**
   * 删除单条提取记录
   */
  async deleteUserExtractLog(userId: string, logId: string): Promise<boolean> {
    await this.ensureTable();
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM \`ResourceExtractLog\` WHERE \`id\` = ? AND \`userId\` = ?`,
        logId,
        userId,
      );
      return true;
    } catch (err: any) {
      logger.error('[ExtractLogService] deleteUserExtractLog error:', err?.message);
      return false;
    }
  }
}

export const extractLogService = new ExtractLogService();
