import { io, Socket } from 'socket.io-client';
import { logError } from '@/utils/error';

// In development, we use same-origin connection to leverage Vite dev server proxy.
// In production, we default to same-origin connection (as Nginx proxies /socket.io),
// but allow overriding via VITE_SOCKET_URL or fallback to VITE_API_URL if needed.
const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.DEV) {
    return '';
  }
  const apiUrl = import.meta.env.VITE_API_URL || '';
  if (
    !apiUrl ||
    apiUrl.startsWith('/') ||
    apiUrl.includes('localhost') ||
    apiUrl.includes('127.0.0.1')
  ) {
    return '';
  }
  return apiUrl;
};

const SOCKET_URL = getSocketUrl();

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

  connect() {
    if (this.socket?.connected) return;

    if (this.socket) {
      this.socket.connect();
      return;
    }

    this.socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 10000,
    });

    // Bind pre-existing listeners that were registered before socket connection was created
    this.listeners.forEach((listener) => {
      this.socket?.on(listener.event, listener.wrapped);
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logError(new Error(`Socket: 达到最大重连次数，停止重连. Error: ${error.message}`), {
          operation: 'socket.maxReconnect',
          component: 'SocketService',
        });
        this.disconnect();
      }
    });
  }

  disconnect() {
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
    if (this.listeners.some((l) => l.event === event && l.callback === storedCallback)) {
      return;
    }

    const wrapped: SocketCallback = (...args) => callback(...(args as TArgs));

    if (this.socket) {
      this.socket.on(event, wrapped);
    }
    this.listeners.push({ event, callback: storedCallback, wrapped });
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
      this.connect();
      const socket = this.socket;
      if (!socket) return;

      let emitted = false;
      const emitWhenConnected = () => {
        emitted = true;
        socket.emit(event, ...args);
      };

      socket.once('connect', emitWhenConnected);
      setTimeout(() => {
        if (emitted) return;
        socket.off('connect', emitWhenConnected);
        console.warn(`Socket: 发送 "${event}" 失败，连接超时`);
      }, 2000);
    }
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
