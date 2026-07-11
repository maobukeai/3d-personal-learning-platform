/**
 * P10 阶段2：Yjs WebSocket 路由集成测试。
 *
 * 覆盖 6 个场景：
 *  1. 未鉴权连接被拒绝（close code 4001）
 *  2. 无权限笔记被拒绝（PRIVATE 笔记，非作者被 close 4003）
 *  3. PUBLIC 笔记任何登录用户可连接（收到 sync step 1）
 *  4. 同步协议：连接后收到 sync step 1，回复 sync step 2 完成初始同步
 *  5. awareness 广播：A 和 B 连同一 room，A 发送 awareness，B 收到
 *  6. 断连清理：A 断连后 connections 减少；全部断连后 room 被销毁
 */

import WebSocket from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../src/services/prisma';
import { fapp, startFastify } from '../src/fastify/app';
import { config } from '../src/config/env';
import { __getRoomConnectionCountForTesting } from '../src/fastify/routes/yjs.routes';

// y-websocket message types (matching yjs.routes.ts)
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const SUFFIX = `${Date.now()}`;
const PASSWORD = 'password123';

let serverPort = 0;
let ownerUserId = '';
let otherUserId = '';
let ownerToken = '';
let otherToken = '';
let privateNoteId = '';
let publicNoteId = '';

/**
 * 将 ws 收到的 RawData 转换为 Uint8Array（供 lib0 decoder 使用）。
 */
const toUint8Array = (data: WebSocket.RawData): Uint8Array => {
  const buf = Buffer.isBuffer(data)
    ? data
    : Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.from(data);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
};

/**
 * 将 Uint8Array 转换为 Buffer（供 ws.send 使用）。
 */
const toBuffer = (arr: Uint8Array): Buffer => {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
};

/**
 * 使用与服务器相同的 JWT secret 签发 token（payload: { id: userId }）。
 */
const signToken = (userId: string): string => {
  return jwt.sign({ id: userId }, config.JWT_SECRET, { algorithm: 'HS256' });
};

/**
 * 建立 WebSocket 连接，在 open 事件后 resolve。
 */
const connectWs = (noteId: string, token?: string, timeoutMs = 5000): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    const query = token ? `?token=${token}` : '';
    const url = `ws://127.0.0.1:${serverPort}/ws/yjs/note/${noteId}${query}`;
    const ws = new WebSocket(url) as any;
    ws.msgBuffer = [];
    ws.on('message', (data: any) => {
      ws.msgBuffer.push(toUint8Array(data));
    });
    const timer = setTimeout(() => {
      ws.removeAllListeners();
      ws.terminate();
      reject(new Error(`Timeout connecting to ${url}`));
    }, timeoutMs);
    ws.once('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once('error', (err: any) => {
      clearTimeout(timer);
      reject(err);
    });
  });
};

/**
 * 等待 WebSocket 被关闭，验证 close code。
 */
const expectWsClose = (ws: WebSocket, expectedCode: number, timeoutMs = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeAllListeners();
      ws.terminate();
      reject(new Error(`Timeout: expected close code ${expectedCode}`));
    }, timeoutMs);
    ws.on('close', (code) => {
      clearTimeout(timer);
      if (code === expectedCode) {
        resolve();
      } else {
        reject(new Error(`Expected close code ${expectedCode}, got ${code}`));
      }
    });
    ws.on('error', () => {
      // error 事件后会紧跟 close 事件，此处不 reject
    });
  });
};

/**
 * 等待下一条 WebSocket 消息。
 */
const waitForMessage = (ws: any, timeoutMs = 5000): Promise<Uint8Array> => {
  if (ws.msgBuffer.length > 0) {
    return Promise.resolve(ws.msgBuffer.shift()!);
  }
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (ws.msgBuffer.length > 0) {
        resolve(ws.msgBuffer.shift()!);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Timeout waiting for message'));
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
};

/**
 * 等待特定条件的消息（过滤）。
 */
const waitForMessageMatching = (
  ws: any,
  predicate: (msg: Uint8Array) => boolean,
  timeoutMs = 5000,
): Promise<Uint8Array> => {
  for (let i = 0; i < ws.msgBuffer.length; i++) {
    if (predicate(ws.msgBuffer[i])) {
      const match = ws.msgBuffer[i];
      ws.msgBuffer.splice(i, 1);
      return Promise.resolve(match);
    }
  }

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      for (let i = 0; i < ws.msgBuffer.length; i++) {
        if (predicate(ws.msgBuffer[i])) {
          const match = ws.msgBuffer[i];
          ws.msgBuffer.splice(i, 1);
          resolve(match);
          return;
        }
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Timeout waiting for matching message'));
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
};

/**
 * 读取 y-websocket 消息的 message type（首字节 varUint）。
 */
const readMessageType = (data: Uint8Array): number => {
  const decoder = decoding.createDecoder(data);
  return decoding.readVarUint(decoder);
};

/**
 * 读取 sync 消息的 sub-type（跳过 message type 后的 varUint）。
 */
const readSyncSubType = (data: Uint8Array): number => {
  const decoder = decoding.createDecoder(data);
  decoding.readVarUint(decoder); // message type
  return decoding.readVarUint(decoder); // sync sub-type
};

/**
 * 轮询 room 连接数直到期望值（或超时）。
 */
const waitForConnectionCount = (
  noteId: string,
  expected: number,
  timeoutMs = 5000,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const actual = __getRoomConnectionCountForTesting(noteId);
      if (actual === expected) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout: expected connection count ${expected}, got ${actual}`));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
};

/**
 * 安全关闭 WebSocket（忽略已关闭的连接）。
 */
const safeClose = (ws: WebSocket | null): void => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
};

describe('Yjs WebSocket Routes', () => {
  beforeAll(async () => {
    // 启动 Fastify（如果已被其他测试启动则跳过）
    try {
      await startFastify();
    } catch {
      // 已启动 —— 忽略重复注册错误
    }
    await fapp.ready();
    if (!fapp.server.listening) {
      await fapp.listen({ port: 0, host: '127.0.0.1' });
    }
    const address = fapp.server.address();
    serverPort = typeof address === 'object' && address ? address.port : 0;
    if (!serverPort) {
      throw new Error('Failed to determine server port');
    }

    // 创建测试用户
    const ownerEmail = `yjs-owner-${SUFFIX}@example.com`;
    const otherEmail = `yjs-other-${SUFFIX}@example.com`;
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });

    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        password: await bcrypt.hash(PASSWORD, 10),
        name: 'Yjs Owner',
        role: 'USER',
      },
    });
    const other = await prisma.user.create({
      data: {
        email: otherEmail,
        password: await bcrypt.hash(PASSWORD, 10),
        name: 'Yjs Other',
        role: 'USER',
      },
    });
    ownerUserId = owner.id;
    otherUserId = other.id;
    ownerToken = signToken(ownerUserId);
    otherToken = signToken(otherUserId);

    // 创建测试笔记（PRIVATE + PUBLIC）
    const privateNote = await prisma.note.create({
      data: {
        title: 'Yjs Private Note',
        content: '# Private\n\nThis is a private note.',
        visibility: 'PRIVATE',
        userId: ownerUserId,
      },
    });
    const publicNote = await prisma.note.create({
      data: {
        title: 'Yjs Public Note',
        content: '# Public\n\nThis is a public note.',
        visibility: 'PUBLIC',
        userId: ownerUserId,
      },
    });
    privateNoteId = privateNote.id;
    publicNoteId = publicNote.id;
  });

  afterAll(async () => {
    await prisma.note
      .deleteMany({ where: { id: { in: [privateNoteId, publicNoteId] } } })
      .catch(() => {});
    const ownerEmail = `yjs-owner-${SUFFIX}@example.com`;
    const otherEmail = `yjs-other-${SUFFIX}@example.com`;
    await prisma.user
      .deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } })
      .catch(() => {});
    await prisma.$disconnect();
    await fapp.close();
  });

  afterEach(async () => {
    // 等待 room 异步清理完成，避免测试间状态泄漏
    await waitForConnectionCount(publicNoteId, 0, 3000).catch(() => {});
  });

  // 1. 未鉴权连接被拒绝
  it('rejects unauthenticated connection (close 4001)', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws/yjs/note/${publicNoteId}`);
    await expectWsClose(ws, 4001);
  });

  // 2. 无权限笔记被拒绝（PRIVATE 笔记，非作者）
  it('rejects connection to a PRIVATE note by non-owner (close 4003)', async () => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${serverPort}/ws/yjs/note/${privateNoteId}?token=${otherToken}`,
    );
    await expectWsClose(ws, 4003);
  });

  // 3. PUBLIC 笔记任何登录用户可连接
  it('allows any logged-in user to connect to a PUBLIC note', async () => {
    const ws = await connectWs(publicNoteId, otherToken);
    const firstMessage = await waitForMessage(ws);
    expect(readMessageType(firstMessage)).toBe(MESSAGE_SYNC);
    expect(readSyncSubType(firstMessage)).toBe(syncProtocol.messageYjsSyncStep1);
    ws.close();
  });

  // 4. 同步协议（sync step 1 → sync step 2）
  it('completes sync protocol (sync step 1 → sync step 2)', async () => {
    const clientYDoc = new Y.Doc();
    const ws = await connectWs(publicNoteId, ownerToken);

    try {
      // 收到 sync step 1
      const serverSyncStep1 = await waitForMessage(ws);
      expect(readMessageType(serverSyncStep1)).toBe(MESSAGE_SYNC);
      expect(readSyncSubType(serverSyncStep1)).toBe(syncProtocol.messageYjsSyncStep1);

      // 处理 sync step 1：readSyncMessage 内部调用 readSyncStep1，
      // 将 client 的状态写入 encoder（sync step 2 回复）
      const replyEncoder = encoding.createEncoder();
      encoding.writeVarUint(replyEncoder, MESSAGE_SYNC);
      const decoder = decoding.createDecoder(serverSyncStep1);
      decoding.readVarUint(decoder); // 消费 message type
      syncProtocol.readSyncMessage(decoder, replyEncoder, clientYDoc, ws);

      // 发送 sync step 2 回复
      const reply = encoding.toUint8Array(replyEncoder);
      expect(reply.length).toBeGreaterThan(1);
      ws.send(toBuffer(reply));

      // 主动发送 sync step 1，请求服务器的缺失内容
      const step1Encoder = encoding.createEncoder();
      encoding.writeVarUint(step1Encoder, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(step1Encoder, clientYDoc);
      ws.send(toBuffer(encoding.toUint8Array(step1Encoder)));

      // 等待服务器回复 sync step 2（包含笔记内容）
      const serverSyncStep2 = await waitForMessageMatching(
        ws,
        (msg) =>
          readMessageType(msg) === MESSAGE_SYNC &&
          readSyncSubType(msg) === syncProtocol.messageYjsSyncStep2,
        5000,
      );
      expect(readSyncSubType(serverSyncStep2)).toBe(syncProtocol.messageYjsSyncStep2);

      // 应用服务器的 sync step 2 到 client Y.Doc
      const applyDecoder = decoding.createDecoder(serverSyncStep2);
      decoding.readVarUint(applyDecoder); // 消费 message type
      const dummyEncoder = encoding.createEncoder();
      syncProtocol.readSyncMessage(applyDecoder, dummyEncoder, clientYDoc, ws);

      // 验证 client Y.Doc 已接收到内容（prosemirror XmlFragment 非空）
      const fragment = clientYDoc.getXmlFragment('prosemirror');
      expect(fragment.length).toBeGreaterThan(0);
    } finally {
      ws.close();
    }
  });

  // 5. awareness 广播
  it('broadcasts awareness updates to other clients in the same room', async () => {
    const wsA = await connectWs(publicNoteId, ownerToken);
    const wsB = await connectWs(publicNoteId, otherToken);

    try {
      // 消费各自连接后的 sync step 1
      await waitForMessage(wsA);
      await waitForMessage(wsB);

      // A 构造 awareness 更新并发送
      const ydocA = new Y.Doc();
      const awarenessA = new awarenessProtocol.Awareness(ydocA);
      awarenessA.setLocalStateField('user', { name: 'User A', color: '#ff0000' });
      const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(awarenessA, [
        awarenessA.clientID,
      ]);

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, awarenessUpdate);
      wsA.send(toBuffer(encoding.toUint8Array(encoder)));

      // B 应收到 awareness 广播
      const broadcast = await waitForMessageMatching(
        wsB,
        (msg) => readMessageType(msg) === MESSAGE_AWARENESS,
        5000,
      );
      expect(readMessageType(broadcast)).toBe(MESSAGE_AWARENESS);

      // 验证 B 可解码 awareness 更新
      const bDecoder = decoding.createDecoder(broadcast);
      decoding.readVarUint(bDecoder); // message type
      const encodedUpdate = decoding.readVarUint8Array(bDecoder);

      const ydocB = new Y.Doc();
      const awarenessB = new awarenessProtocol.Awareness(ydocB);
      awarenessProtocol.applyAwarenessUpdate(awarenessB, encodedUpdate, null);
      expect(awarenessB.getStates().size).toBeGreaterThan(0);
    } finally {
      safeClose(wsA);
      safeClose(wsB);
    }
  });

  // 6. 断连清理
  it('cleans up room on disconnect (connections decrease, room destroyed when empty)', async () => {
    const noteId = publicNoteId;

    // A 连接
    const wsA = await connectWs(noteId, ownerToken);
    await waitForMessage(wsA); // sync step 1
    await waitForConnectionCount(noteId, 1);

    // B 连接
    const wsB = await connectWs(noteId, otherToken);
    await waitForMessage(wsB); // sync step 1
    await waitForConnectionCount(noteId, 2);

    // A 断连 → connections 减为 1
    wsA.close();
    await waitForConnectionCount(noteId, 1);

    // B 断连 → connections 减为 0，room 被销毁
    wsB.close();
    await waitForConnectionCount(noteId, 0);
  });
});
