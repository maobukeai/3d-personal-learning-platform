import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private listeners: { event: string, callback: (...args: any[]) => void }[] = [];

  connect() {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      // Re-register any listeners that were added before connection
      this.listeners.forEach(({ event, callback }) => {
        this.socket?.on(event, callback);
      });
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners = [];
    }
  }

  getSocket() {
    return this.socket;
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
    // Always store in listeners to re-register on reconnect/late connect
    if (!this.listeners.some(l => l.event === event && l.callback === callback)) {
      this.listeners.push({ event, callback });
    }
  }

  off(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
    this.listeners = this.listeners.filter(l => !(l.event === event && l.callback === callback));
  }

  emit(event: string, ...args: any[]) {
    if (this.socket) {
      this.socket.emit(event, ...args);
    } else {
      console.warn(`Attempted to emit "${event}" but socket is not connected`);
    }
  }
}

export const socketService = new SocketService();
