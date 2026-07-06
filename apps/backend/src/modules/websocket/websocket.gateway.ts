import {
  WebSocketGateway as NestWebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@NestWebSocketGateway({
  cors: { origin: '*', credentials: true },
  transports: ['websocket'],
  namespace: '/ws',
})
export class WebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WebSocketGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server) {
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => this.logger.error('WS Redis pub error', err.message));
    subClient.on('error', (err) => this.logger.error('WS Redis sub error', err.message));

    // socket.io v4.7+ changed adapter from a callable method to a getter/setter
    const adapterFactory = createAdapter(pubClient, subClient);
    if (typeof (server as any).adapter === 'function') {
      (server as any).adapter(adapterFactory);
    } else {
      (server as any).adapter = adapterFactory;
    }
    this.logger.log('WebSocket gateway initialized with Redis adapter');
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token ?? client.handshake.query?.token as string;

    if (!token) {
      this.logger.warn(`WS client ${client.id} connected without token — disconnecting`);
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwt.verify(token, { algorithms: ['RS256'] }) as { sub: string; type: string };
      if (payload.type !== 'access') throw new Error('Wrong token type');

      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
      this.logger.log(`WS client ${client.id} joined user:${payload.sub}`);
    } catch {
      this.logger.warn(`WS client ${client.id} auth failed — disconnecting`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS client ${client.id} disconnected`);
  }

  // ── Emit helpers (called by NotificationsService) ────────────────────────────

  emitToUser(userId: string, event: string, data: unknown) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // ── Client → server events ───────────────────────────────────────────────────

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() _data: unknown) {
    client.emit('pong', { ts: Date.now() });
  }
}
