import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type SocketCallback<TArgs extends unknown[] = unknown[]> = (...args: TArgs) => void;
type StoredListener = {
  event: string;
  callback: SocketCallback;
  wrapped: SocketCallback;
};

class SocketService {
  private socket: Socket | null = null;
  private listeners: StoredListener[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.listeners.forEach(({ event, wrapped }) => {
        this.socket?.on(event, wrapped);
      });
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Socket: 达到最大重连次数，停止重连');
        this.disconnect();
      }
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners = [];
    }
  }

  getSocket() {
    return this.socket;
  }

  on<TArgs extends unknown[]>(event: string, callback: SocketCallback<TArgs>) {
    const storedCallback = callback as SocketCallback;
    const wrapped: SocketCallback = (...args) => callback(...(args as TArgs));

    if (this.socket) {
      this.socket.on(event, wrapped);
    }
    if (!this.listeners.some((l) => l.event === event && l.callback === storedCallback)) {
      this.listeners.push({ event, callback: storedCallback, wrapped });
    }
  }

  off<TArgs extends unknown[]>(event: string, callback?: SocketCallback<TArgs>) {
    const storedCallback = callback as SocketCallback | undefined;
    const matchingListeners = storedCallback
      ? this.listeners.filter((l) => l.event === event && l.callback === storedCallback)
      : this.listeners.filter((l) => l.event === event);

    if (this.socket) {
      if (storedCallback) {
        matchingListeners.forEach((listener) => this.socket?.off(event, listener.wrapped));
      } else {
        this.socket.off(event);
      }
    }
    if (storedCallback) {
      this.listeners = this.listeners.filter(
        (l) => !(l.event === event && l.callback === storedCallback),
      );
    } else {
      this.listeners = this.listeners.filter((l) => l.event !== event);
    }
  }

  emit(event: string, ...args: unknown[]) {
    if (this.socket?.connected) {
      this.socket.emit(event, ...args);
    } else {
      // If not connected, attempt to connect and wait briefly
      this.connect();
      
      // We'll wait up to 2 seconds for a connection before giving up on this emit
      let attempts = 0;
      const checkInterval = setInterval(() => {
        if (this.socket?.connected) {
          this.socket.emit(event, ...args);
          clearInterval(checkInterval);
        } else if (attempts > 20) { // 2 seconds
          console.warn(`Socket: 发送 "${event}" 失败，连接超时`);
          clearInterval(checkInterval);
        }
        attempts++;
      }, 100);
    }
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
