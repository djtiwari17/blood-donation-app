import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FCM_PROJECT_ID');
    const privateKey = this.config.get<string>('FCM_PRIVATE_KEY');
    const clientEmail = this.config.get<string>('FCM_CLIENT_EMAIL');

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn('FCM not configured — push notifications disabled (set FCM_* env vars for prod)');
      return;
    }

    // Avoid re-initializing on NestJS hot-reload
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        }),
      });
    }

    this.enabled = true;
    this.logger.log('Firebase Admin initialized');
  }

  async sendToToken(token: string, payload: FcmPayload): Promise<void> {
    if (!this.enabled) return;
    if (!token) return;

    try {
      await admin.messaging().send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
    } catch (err: any) {
      // Invalid / expired tokens are silently dropped — they'll be cleaned up on next login
      this.logger.warn(`FCM send failed for token ${token.slice(0, 20)}...: ${err.message}`);
    }
  }
}
