import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FcmService } from './fcm.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';

export type NotificationType =
  | 'MATCH_FOUND'
  | 'MATCH_ACCEPTED'
  | 'MATCH_DECLINED'
  | 'REQUEST_FULFILLED'
  | 'REQUEST_EXPIRED';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
    private readonly wsGateway: WebSocketGateway,
  ) {}

  // ── Create & deliver a notification ─────────────────────────────────────────

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    relatedId?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, relatedId },
    });

    // Real-time WebSocket delivery (best-effort)
    this.wsGateway.emitToUser(userId, 'notification', {
      id: notification.id,
      type,
      title,
      body,
      relatedId,
      createdAt: notification.createdAt,
    });

    // FCM push notification (best-effort)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    if (user?.fcmToken) {
      await this.fcm.sendToToken(user.fcmToken, { title, body, data: { type, relatedId: relatedId ?? '' } });
    }

    return notification;
  }

  // ── Domain-specific helpers ──────────────────────────────────────────────────

  async notifyMatchFound(donorUserId: string, requestId: string, matchId: string, bloodGroup: string, hospitalName: string) {
    return this.create(
      donorUserId,
      'MATCH_FOUND',
      'New Blood Request Nearby',
      `A patient needing ${bloodGroup} blood at ${hospitalName} needs your help.`,
      matchId,
    );
  }

  async notifyMatchAccepted(receiverUserId: string, requestId: string, donorName: string) {
    return this.create(
      receiverUserId,
      'MATCH_ACCEPTED',
      'Donor Accepted Your Request',
      `${donorName} has agreed to donate. Their contact is now visible to you.`,
      requestId,
    );
  }

  async notifyMatchDeclined(receiverUserId: string, requestId: string) {
    return this.create(
      receiverUserId,
      'MATCH_DECLINED',
      'A Donor Declined',
      'One donor declined your request. We are searching for others.',
      requestId,
    );
  }

  async notifyRequestFulfilled(receiverUserId: string, requestId: string) {
    return this.create(
      receiverUserId,
      'REQUEST_FULFILLED',
      'Request Fulfilled!',
      'Enough donors have been found for your blood request.',
      requestId,
    );
  }

  async notifyRequestExpired(receiverUserId: string, requestId: string) {
    return this.create(
      receiverUserId,
      'REQUEST_EXPIRED',
      'Request Expired',
      'Your blood request has expired without being fulfilled. Please create a new one if still needed.',
      requestId,
    );
  }

  // ── Read / list ───────────────────────────────────────────────────────────────

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      notifications,
      unreadCount,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }
}
