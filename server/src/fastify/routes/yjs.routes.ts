import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import prisma from '../../services/prisma';
import { logger } from '../../utils/logger';
import { loadYDoc, yjsPersister } from '../../services/yjs.persistence';

/**
 * P10 阶段2：Yjs 协同 WebSocket 路由。
 *
 * 协议兼容 y-websocket 客户端（TiptapMarkdownEditor.vue 已导入 WebsocketProvider）：
 *  - 完整路径：GET /ws/yjs/note/:noteId（app.ts 注册 prefix=/ws，本文件挂 /yjs/note/:noteId）
 *  - 鉴权：URL query param ?token=<JWT>（与 y-websocket WebsocketProvider params 一致）
 *  - Room 隔离：每个 noteId 一个 Y.Doc + 一组连接
 *
 * y-websocket 二进制协议：
 *  - 消息首字节为 message type (0=sync-step1, 1=sync-step2, 2=awareness, 3=query-awareness)
 *  - sync payload 用 y-protocols/sync 编解码
 *  - awareness payload 用 y-protocols/awareness 编解码
 */

// y-websocket message types
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 2;

interface RoomState {
  ydoc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  connections: Set<WebSocket>;
  connectedUsers: Map<string, string>; // userId → username（用于 awareness 元数据）
}

// 全局 room 注册表（进程内）
const rooms = new Map<string, RoomState>();

/**
 * 鉴权：从 query token 解析 userId。
 * 复用与 Express 相同的 JWT secret + HS256 算法。
 */
const authenticateWs = (token: string | undefined): { userId: string } | null => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
    };
    return { userId: decoded.id };
  } catch {
    return null;
  }
};

/**
 * 验证用户对该笔记的访问权限。
 * 笔记 visibility 为 PUBLIC 时任何登录用户可访问；PRIVATE 时仅作者可访问。
 */
const checkNoteAccess = async (noteId: string, userId: string): Promise<boolean> => {
  try {
    const note = await prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, userId: true, visibility: true },
    });
    if (!note) return false;
    if (note.visibility === 'PUBLIC') return true;
    return note.userId === userId;
  } catch (err) {
    logger.error(`[Yjs] Note access check failed for note ${noteId}:`, err);
    return false;
  }
};

/**
 * 获取或创建 room（含从 Redis 加载 Y.Doc 状态）。
 */
const getOrCreateRoom = async (noteId: string): Promise<RoomState> => {
  let room = rooms.get(noteId);
  if (!room) {
    const ydoc = await loadYDoc(noteId);
    const awareness = new awarenessProtocol.Awareness(ydoc);

    // Y.Doc 更新时：广播给其他连接 + 防抖持久化到 Redis
    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);

      const message = encoding.toUint8Array(encoder);
      const messageBuffer = Buffer.from(message.buffer, message.byteOffset, message.byteLength);

      for (const conn of room!.connections) {
        // 不回发给 update 的来源（origin 是该 WebSocket）
        if (conn !== origin && conn.readyState === 1) {
          conn.send(messageBuffer);
        }
      }

      // 防抖持久化
      yjsPersister.schedule(noteId, ydoc);
    });

    // awareness 更新时广播给所有连接
    awareness.on(
      'update',
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        const changedClients = new Set([...added, ...updated, ...removed]);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(room!.awareness, Array.from(changedClients)),
        );
        const message = encoding.toUint8Array(encoder);
        const messageBuffer = Buffer.from(message.buffer, message.byteOffset, message.byteLength);

        for (const conn of room!.connections) {
          if (conn.readyState === 1) {
            conn.send(messageBuffer);
          }
        }
      },
    );

    room = { ydoc, awareness, connections: new Set(), connectedUsers: new Map() };
    rooms.set(noteId, room);
    logger.info(`[Yjs] Room created for note ${noteId}`);
  }
  return room;
};

/**
 * 处理 incoming WebSocket 消息（y-websocket 协议）。
 */
const handleMessage = (ws: WebSocket, room: RoomState, data: Buffer): void => {
  try {
    const uint8Data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const decoder = decoding.createDecoder(uint8Data);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MESSAGE_SYNC: {
        // readSyncMessage 签名：(decoder, encoder, doc, origin)
        // 它会根据消息类型（step1/step2/update）写入回复到 encoder
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, room.ydoc, ws);

        // 发送回复（如果有内容）
        const reply = encoding.toUint8Array(encoder);
        if (reply.length > 1 && ws.readyState === 1) {
          const replyBuffer = Buffer.from(reply.buffer, reply.byteOffset, reply.byteLength);
          ws.send(replyBuffer);
        }
        break;
      }
      case MESSAGE_AWARENESS: {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
        break;
      }
      case MESSAGE_QUERY_AWARENESS: {
        // 回复当前 awareness 状态
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(
            room.awareness,
            Array.from(room.awareness.getStates().keys()),
          ),
        );
        const reply = encoding.toUint8Array(encoder);
        const replyBuffer = Buffer.from(reply.buffer, reply.byteOffset, reply.byteLength);
        if (ws.readyState === 1) {
          ws.send(replyBuffer);
        }
        break;
      }
      default:
        logger.debug(`[Yjs] Unknown message type: ${messageType}`);
        break;
    }
  } catch (err) {
    logger.warn('[Yjs] Failed to handle WebSocket message:', err);
  }
};

/**
 * 清理断开连接的 WebSocket：从 room 移除，awareness 标记离线，room 空时销毁。
 */
const handleDisconnect = (
  ws: WebSocket,
  room: RoomState,
  noteId: string,
  clientId: number,
): void => {
  room.connections.delete(ws);

  // 从 awareness 移除该 client
  awarenessProtocol.removeAwarenessStates(room.awareness, [clientId], ws);

  // room 空时：最终持久化 + 清理
  if (room.connections.size === 0) {
    void yjsPersister.flush(noteId, room.ydoc).then(() => {
      room.ydoc.destroy();
      rooms.delete(noteId);
      logger.info(`[Yjs] Room destroyed for note ${noteId} (0 connections)`);
    });
  }
};

/**
 * 注册 Yjs WebSocket 路由。
 * 注意：本函数在 app.ts 中通过 { prefix: '/ws' } 注册，
 * 因此这里路径写作 /yjs/note/:noteId，最终完整路径为 /ws/yjs/note/:noteId。
 * 避免重复 /ws/ws/yjs/... 前缀。
 */
export const registerYjsRoutes = (app: FastifyInstance): void => {
  app.get('/yjs/note/:noteId', { websocket: true }, async (ws, request) => {
    const { noteId } = request.params as { noteId: string };
    const query = request.query as { token?: string };
    const token = query.token || request.cookies.token;

    // 1) 鉴权
    const auth = authenticateWs(token);
    if (!auth) {
      logger.warn(`[Yjs] WS connection rejected: no valid token for note ${noteId}`);
      ws.close(4001, 'Unauthorized');
      return;
    }

    // 2) 权限校验
    const hasAccess = await checkNoteAccess(noteId, auth.userId);
    if (!hasAccess) {
      logger.warn(
        `[Yjs] WS connection rejected: user ${auth.userId} has no access to note ${noteId}`,
      );
      ws.close(4003, 'Forbidden');
      return;
    }

    // 3) 获取或创建 room
    const room = await getOrCreateRoom(noteId);
    room.connections.add(ws);

    // 为该连接分配 awareness client ID（Y.Doc 内部 ID）
    const clientId = room.ydoc.clientID;
    void clientId; // awareness 使用自身的 clientID

    logger.info(
      `[Yjs] User ${auth.userId} connected to note ${noteId} (${room.connections.size} connections)`,
    );

    // 4) 连接建立后：发送 sync step 1（请求客户端的状态）
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, room.ydoc);
    const syncMessage = encoding.toUint8Array(encoder);
    const syncBuffer = Buffer.from(
      syncMessage.buffer,
      syncMessage.byteOffset,
      syncMessage.byteLength,
    );
    if (ws.readyState === 1) {
      ws.send(syncBuffer);
    }

    // 5) 处理消息
    ws.on('message', (data: unknown) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      handleMessage(ws, room, buf);
    });

    // 6) 处理断开
    ws.on('close', () => {
      handleDisconnect(ws, room, noteId, room.awareness.clientID);
      logger.info(
        `[Yjs] User ${auth.userId} disconnected from note ${noteId} (${room.connections.size} connections)`,
      );
    });

    ws.on('error', (err) => {
      logger.warn(`[Yjs] WebSocket error for note ${noteId}:`, err);
      handleDisconnect(ws, room, noteId, room.awareness.clientID);
    });
  });
};

/**
 * @internal 仅用于集成测试验证 room 生命周期（连接数 / 销毁）。生产代码不应调用。
 */
export const __getRoomConnectionCountForTesting = (noteId: string): number => {
  return rooms.get(noteId)?.connections.size ?? 0;
};
