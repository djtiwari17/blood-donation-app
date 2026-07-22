import { Injectable, Logger } from '@nestjs/common';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

/**
 * Delivers push notifications through the Expo push service (no native Firebase).
 * Returns the subset of tokens Expo reports as permanently invalid so the caller
 * can prune them.
 */
@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  async sendToTokens(tokens: string[], payload: PushPayload): Promise<string[]> {
    const valid = tokens.filter(
      t => t && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')),
    );
    if (valid.length === 0) return [];

    const messages = valid.map(to => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    }));

    const invalidTokens: string[] = [];

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(batch),
        });
        const json: any = await res.json();
        const tickets: any[] = json?.data ?? [];
        tickets.forEach((ticket, idx) => {
          if (ticket?.status === 'error') {
            const token = batch[idx].to;
            this.logger.warn(`Expo push error for ${token.slice(0, 24)}…: ${ticket.message}`);
            if (ticket?.details?.error === 'DeviceNotRegistered') invalidTokens.push(token);
          }
        });
      } catch (err: any) {
        this.logger.warn(`Expo push request failed: ${err.message}`);
      }
    }

    return invalidTokens;
  }
}
