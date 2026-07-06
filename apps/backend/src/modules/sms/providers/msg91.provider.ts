import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ISmsProvider } from '../interfaces/sms-provider.interface';

@Injectable()
export class Msg91SmsProvider implements ISmsProvider {
  readonly name = 'msg91';
  private readonly logger = new Logger(Msg91SmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(to: string, message: string): Promise<void> {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    const templateId = this.config.get<string>('MSG91_TEMPLATE_ID');
    // Strip +91, keep 10 digits
    const mobile = to.replace(/^\+91/, '').replace(/\D/g, '');
    const otp = message.match(/\d{6}/)?.[0] ?? message;

    await axios.post(
      'https://api.msg91.com/api/v5/flow/',
      { template_id: templateId, mobiles: `91${mobile}`, otp, short_url: '0' },
      {
        headers: { authkey: authKey, 'Content-Type': 'application/json' },
        timeout: 6000,
      },
    );
    this.logger.debug(`MSG91 → ${to}`);
  }
}
