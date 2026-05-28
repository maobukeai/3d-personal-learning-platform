import { logger } from '../utils/logger';
import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import prisma from './prisma';

let io: SocketServer;
const onlineUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

const canAccessConversation = async (userId: string, conversationId: string) => {
  if (!conversationId || typeof conversationId !== 'string') return false;

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: {
        some: { id: userId },
      },
    },
    select: { id: true },
  });

  return Boolean(conversation);
};

export const initSocket = (server: HttpServer) => {
  io = new SocketServer(server, {
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = [
          'http://localhost:5173',
          'http://localhost:3000',
          process.env.FRONTEND_URL,
        ].filter(Boolean) as string[];
        if (
          !origin ||
          allowedOrigins.indexOf(origin) !== -1 ||
          process.env.NODE_ENV === 'development'
        ) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware for socket
  io.use((socket, next) => {
    let token = socket.handshake.auth.token || socket.handshake.headers.authorization;

    // Check cookies if not in auth/headers
    if (!token && socket.handshake.headers.cookie) {
      const cookies = socket.handshake.headers.cookie.split(';').reduce(
        (acc: Record<string, string>, curr) => {
          const parts = curr.trim().split('=');
          const key = parts[0];
          const value = parts[1];
          if (key && value) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
      token = cookies['token'];
    }

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = jwt.verify(cleanToken, config.JWT_SECRET, { algorithms: ['HS256'] }) as {
        id: string;
      };
      (socket as unknown as { userId: string }).userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as unknown as { userId: string }).userId;
    logger.info(`User connected: ${userId} (${socket.id})`);

    // Add this socket to user's socket set
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    const userSockets = onlineUsers.get(userId)!;
    const wasOffline = userSockets.size === 0;
    userSockets.add(socket.id);

    // Only emit online status when first device connects
    if (wasOffline) {
      io.emit('user_status', { userId, status: 'online' });
    }

    // Send initial list of online users
    socket.emit('online_users_list', Array.from(onlineUsers.keys()));

    // Join conversation rooms
    socket.on('join_conversation', async (conversationId: string) => {
      try {
        if (!(await canAccessConversation(userId, conversationId))) {
          logger.warn(
            `Blocked unauthorized conversation join: user=${userId} conversation=${conversationId}`,
          );
          socket.emit('conversation_access_denied', { conversationId });
          return;
        }

        socket.join(`conversation_${conversationId}`);
        logger.info(`User ${userId} joined conversation: ${conversationId}`);
      } catch (error) {
        logger.error('Failed to authorize conversation join:', error);
        socket.emit('conversation_access_denied', { conversationId });
      }
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation_${conversationId}`);
    });

    // Handle typing status
    socket.on(
      'typing',
      async ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
        try {
          if (!(await canAccessConversation(userId, conversationId))) {
            logger.warn(
              `Blocked unauthorized typing event: user=${userId} conversation=${conversationId}`,
            );
            return;
          }
        } catch (error) {
          logger.error('Failed to authorize typing event:', error);
          return;
        }

        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          userId,
          conversationId,
          isTyping,
        });
      },
    );

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${userId} (${socket.id})`);

      // Remove this socket from user's set
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        // If no more sockets for this user, remove from map and emit offline
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user_status', { userId, status: 'offline' });
        }
      }
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: unknown) => {
  const userSocketIds = onlineUsers.get(userId);
  if (userSocketIds) {
    for (const socketId of userSocketIds) {
      io.to(socketId).emit(event, data);
    }
  }
};

export const emitToAll = (event: string, data: unknown) => {
  if (io) {
    io.emit(event, data);
  }
};

export const emitToConversation = (conversationId: string, event: string, data: unknown) => {
  logger.info(`Emitting ${event} to conversation_${conversationId}`);
  io.to(`conversation_${conversationId}`).emit(event, data);
};
