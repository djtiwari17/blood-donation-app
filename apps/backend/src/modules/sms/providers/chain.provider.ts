import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from '../interfaces/sms-provider.interface';
import { ConsoleSmsProvider } from './console.provider';
import { Msg91SmsProvider } from './msg91.provider';
import { TwilioSmsProvider } from './twilio.provider';

@Injectable()
export class ChainSmsProvider implements ISmsProvider {
  readonly name = 'chain';
  private readonly logger = new Logger(ChainSmsProvider.name);
  private readonly chain: ISmsProvider[];

  constructor(
    config: ConfigService,
    msg91: Msg91SmsProvider,
    twilio: TwilioSmsProvider,
    consoleSms: ConsoleSmsProvider,
  ) {
    const primary = config.get<string>('SMS_PROVIDER') ?? 'console';
    // MSG91 → Twilio → Console (fallback order)
    if (primary === 'msg91') {
      this.chain = [msg91, twilio, consoleSms];
    } else if (primary === 'twilio') {
      this.chain = [twilio, msg91, consoleSms];
    } else {
      this.chain = [consoleSms];
    }
    this.logger.log(`SMS chain: ${this.chain.map(p => p.name).join(' → ')}`);
  }

  async send(to: string, message: string): Promise<void> {
    let lastErr: Error | undefined;
    for (const provider of this.chain) {
      try {
        await provider.send(to, message);
        return;
      } catch (err) {
        lastErr = err as Error;
        this.logger.warn(`${provider.name} failed (${lastErr.message}), trying next`);
      }
    }
    throw lastErr ?? new Error('All SMS providers failed');
  }
}
