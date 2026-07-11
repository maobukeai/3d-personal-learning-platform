import * as Y from 'yjs';
import { redisService } from '../services/redis.service';
import prisma from '../services/prisma';
import { logger } from '../utils/logger';
import { rebuildYDocFromMarkdown } from '../utils/yjs-markdown';

/**
 * P10 阶段3+4：Yjs Y.Doc 的持久化层（Redis + Postgres 重建）。
 *
 * 策略：
 *  - 每个 room（note）的 Y.Doc 二进制状态以 base64 存储在 Redis key `ydoc:note:{noteId}` 中
 *  - TTL 24h（笔记活跃期足够长，过期后从 Postgres Note.content 重建）
 *  - 更新防抖：2s 内多次 update 只写一次 Redis，避免高频写入
 *  - Redis 未命中时：从 Note.content（Markdown）重建 Y.Doc，异步回写 Redis
 *
 * 与 y-websocket 协议兼容：Y.Doc 状态用 Y.encodeStateAsUpdate 序列化，
 * 恢复时用 Y.applyUpdate 反序列化。
 *
 * 重建路径（P10 阶段4）：
 *  Markdown → marked.lexer → Tiptap JSON → Y.XmlFragment（y-prosemirror 格式）
 *  Y.XmlFragment 存储在 ydoc.getXmlFragment('prosemirror')，与前端 ySyncPlugin 一致。
 */

const YDOC_TTL_SECONDS = 24 * 60 * 60; // 24h
const YDOC_KEY_PREFIX = 'ydoc:note:';
const PERSIST_DEBOUNCE_MS = 2000;

/**
 * 从 Postgres/MySQL Note 表读取 content（Markdown 字符串）并重建 Y.Doc。
 *
 * 重建后的 Y.Doc 包含 Tiptap JSON 对应的 ProseMirror 节点（存储为 Y.XmlFragment）。
 * 如果 Note 不存在或 content 为空，返回 false（调用方保持空 Y.Doc）。
 */
const rebuildYDocFromPostgres = async (noteId: string, ydoc: Y.Doc): Promise<boolean> => {
  try {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { content: true },
    });
    if (!note || !note.content || !note.content.trim()) {
      return false;
    }
    rebuildYDocFromMarkdown(ydoc, note.content);
    logger.info(
      `[Yjs] Rebuilt Y.Doc for note ${noteId} from Postgres content (${note.content.length} chars)`,
    );
    return true;
  } catch (err) {
    logger.warn(`[Yjs] Failed to rebuild Y.Doc for note ${noteId} from Postgres:`, err);
    return false;
  }
};

/**
 * 从 Redis 加载 Y.Doc 状态。
 *
 * 加载顺序：
 *  1. Redis 缓存命中 → 反序列化二进制状态
 *  2. Redis 未命中 → 从 Postgres Note.content（Markdown）重建 Y.Doc
 *  3. Postgres 也不存在/为空 → 返回空 Y.Doc（保持原有行为）
 *
 * 重建后异步回写 Redis（不阻塞返回），避免下一次冷启动。
 */
export const loadYDoc = async (noteId: string): Promise<Y.Doc> => {
  const ydoc = new Y.Doc();
  try {
    const base64 = await redisService.get<string>(`${YDOC_KEY_PREFIX}${noteId}`);
    if (base64) {
      const buffer = Buffer.from(base64, 'base64');
      const update = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      Y.applyUpdate(ydoc, update);
      logger.debug(`[Yjs] Loaded Y.Doc for note ${noteId} from Redis (${buffer.length} bytes)`);
    } else {
      // Redis 未命中：从 Postgres Note.content 重建
      const rebuilt = await rebuildYDocFromPostgres(noteId, ydoc);
      if (rebuilt) {
        // 异步回写 Redis（不阻塞返回）
        void saveYDoc(noteId, ydoc).catch((err) => {
          logger.warn(`[Yjs] Failed to backfill Redis for note ${noteId} after rebuild:`, err);
        });
      }
    }
  } catch (err) {
    logger.warn(`[Yjs] Failed to load Y.Doc for note ${noteId}, starting fresh:`, err);
  }
  return ydoc;
};

/**
 * 将 Y.Doc 状态保存到 Redis（base64 编码）。
 */
export const saveYDoc = async (noteId: string, ydoc: Y.Doc): Promise<void> => {
  try {
    const update = Y.encodeStateAsUpdate(ydoc);
    const buffer = Buffer.from(update.buffer, update.byteOffset, update.byteLength);
    const base64 = buffer.toString('base64');
    await redisService.set(`${YDOC_KEY_PREFIX}${noteId}`, base64, YDOC_TTL_SECONDS);
    logger.debug(`[Yjs] Persisted Y.Doc for note ${noteId} to Redis (${buffer.length} bytes)`);
  } catch (err) {
    logger.warn(`[Yjs] Failed to persist Y.Doc for note ${noteId}:`, err);
  }
};

/**
 * 防抖持久化管理器 —— 同一 room 的多次 update 在 PERSIST_DEBOUNCE_MS 内只写一次。
 */
class DebouncedPersister {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * 调度一次防抖保存。如在 debounce 窗口内多次调用，只保留最后一次。
   */
  schedule(noteId: string, ydoc: Y.Doc): void {
    const existing = this.timers.get(noteId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.timers.delete(noteId);
      void saveYDoc(noteId, ydoc);
    }, PERSIST_DEBOUNCE_MS);

    this.timers.set(noteId, timer);
  }

  /**
   * 立即刷新指定 room 的待保存（用于 room 销毁前的最终保存）。
   */
  async flush(noteId: string, ydoc: Y.Doc): Promise<void> {
    const existing = this.timers.get(noteId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(noteId);
    }
    await saveYDoc(noteId, ydoc);
  }

  /**
   * 清理所有定时器（进程退出时调用）。
   */
  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

export const yjsPersister = new DebouncedPersister();

/**
 * 从 Redis 删除 Y.Doc 缓存（笔记删除时调用）。
 */
export const deleteYDoc = async (noteId: string): Promise<void> => {
  try {
    await redisService.del(`${YDOC_KEY_PREFIX}${noteId}`);
    logger.debug(`[Yjs] Deleted Y.Doc cache for note ${noteId}`);
  } catch (err) {
    logger.warn(`[Yjs] Failed to delete Y.Doc for note ${noteId}:`, err);
  }
};
