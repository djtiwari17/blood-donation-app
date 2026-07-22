import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ExpoPushService } from './expo-push.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';

export type NotificationType =
  | 'MATCH_FOUND'
  | 'MATCH_ACCEPTED'
  | 'MATCH_DECLINED'
  | 'REQUEST_FULFILLED'
  | 'REQUEST_EXPIRED'
  | 'CAMP_REMINDER'
  | 'DONATION_ANNIVERSARY';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPush: ExpoPushService,
    private readonly wsGateway: WebSocketGateway,
  ) {}

  // ── Push token registration (multi-device) ───────────────────────────────────

  async registerToken(userId: string, token: string, platform?: string) {
    // A token is device-unique; reassign it if the device switched accounts.
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, lastUsedAt: new Date() },
    });
    return { success: true };
  }

  async removeToken(token: string) {
    await this.prisma.pushToken.deleteMany({ where: { token } });
    return { success: true };
  }

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

    // Expo push delivery to all of the user's registered devices (best-effort).
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (tokens.length > 0) {
      const invalid = await this.expoPush.sendToTokens(
        tokens.map(t => t.token),
        { title, body, data: { type, relatedId: relatedId ?? '' } },
      );
      if (invalid.length > 0) {
        await this.prisma.pushToken.deleteMany({ where: { token: { in: invalid } } });
      }
    }

    return notification;
  }

  // ── Domain-specific helpers ──────────────────────────────────────────────────

  async notifyMatchFound(donorUserId: string, requestId: string, _matchId: string, bloodGroup: string, hospitalName: string) {
    return this.create(
      donorUserId,
      'MATCH_FOUND',
      'New Blood Request Nearby',
      `A patient needing ${bloodGroup} blood at ${hospitalName} needs your help.`,
      // relatedId = requestId so a tap can deep-link to the request details.
      requestId,
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

  async notifyCampReminder(userId: string, campId: string, campName: string, timeLabel: string) {
    return this.create(
      userId,
      'CAMP_REMINDER',
      'Blood Camp Reminder',
      `${campName} is today at ${timeLabel}. See you there!`,
      campId,
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
