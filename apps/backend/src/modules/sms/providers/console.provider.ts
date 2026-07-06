import { Injectable, Logger } from '@nestjs/common';
import { ISmsProvider } from '../interfaces/sms-provider.interface';

@Injectable()
export class ConsoleSmsProvider implements ISmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger('ConsoleSMS');

  async send(to: string, message: string): Promise<void> {
    this.logger.log(`[ConsoleSMS] → ${to} | ${message}`);
  }
}
