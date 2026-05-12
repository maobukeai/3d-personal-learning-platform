import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

let io: SocketServer;
const onlineUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

export const initSocket = (server: HttpServer) => {
  io = new SocketServer(server, {
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = [
          'http://localhost:5173',
          'http://localhost:3000',
          process.env.FRONTEND_URL
        ].filter(Boolean) as string[];
        if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = jwt.verify(cleanToken, config.JWT_SECRET) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    console.log(`User connected: ${userId} (${socket.id})`);
    
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
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`User ${userId} joined conversation: ${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation_${conversationId}`);
    });

    // Handle typing status
    socket.on('typing', ({ conversationId, isTyping }: { conversationId: string, isTyping: boolean }) => {
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        userId,
        conversationId,
        isTyping
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId} (${socket.id})`);
      
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

export const emitToUser = (userId: string, event: string, data: any) => {
  const userSocketIds = onlineUsers.get(userId);
  if (userSocketIds) {
    for (const socketId of userSocketIds) {
      io.to(socketId).emit(event, data);
    }
  }
};

export const emitToAll = (event: string, data: any) => {
  if (io) {
    io.emit(event, data);
  }
};

export const emitToConversation = (conversationId: string, event: string, data: any) => {
  console.log(`Emitting ${event} to conversation_${conversationId}`);
  io.to(`conversation_${conversationId}`).emit(event, data);
};
