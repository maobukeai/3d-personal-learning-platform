import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

interface UserSocket {
  userId: string;
  socketId: string;
}

let io: SocketServer;
const onlineUsers = new Map<string, string>(); // userId -> socketId

export const initSocket = (server: HttpServer) => {
  io = new SocketServer(server, {
    cors: {
      origin: '*', // In production, replace with actual origin
      methods: ['GET', 'POST']
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
    
    onlineUsers.set(userId, socket.id);
    io.emit('user_status', { userId, status: 'online' });

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
      console.log(`User disconnected: ${userId}`);
      onlineUsers.delete(userId);
      io.emit('user_status', { userId, status: 'offline' });
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
  const socketId = onlineUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
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
