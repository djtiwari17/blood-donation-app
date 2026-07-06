import { io, Socket } from 'socket.io-client';
import { API_URL } from '../constants/api';

// API_URL includes /v1; WebSocket gateway lives at the root server path
const WS_BASE = API_URL.replace(/\/v1$/, '');

type NotificationEvent = {
  id: string;
  type: string;
  title: string;
  body: string;
  relatedId: string | null;
  createdAt: string;
};

type NotificationListener = (notification: NotificationEvent) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: NotificationListener[] = [];

  connect(accessToken: string) {
    if (this.socket?.connected) return;

    this.socket = io(`${WS_BASE}/ws`, {
      transports: ['websocket'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      console.log('[WS] Connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[WS] Connection error:', err.message);
    });

    this.socket.on('notification', (data: NotificationEvent) => {
      this.listeners.forEach(fn => fn(data));
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  addNotificationListener(fn: NotificationListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const wsService = new WebSocketService();
