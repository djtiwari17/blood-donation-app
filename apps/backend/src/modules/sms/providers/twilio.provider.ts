import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ISmsProvider } from '../interfaces/sms-provider.interface';

@Injectable()
export class TwilioSmsProvider implements ISmsProvider {
  readonly name = 'twilio';
  private readonly logger = new Logger(TwilioSmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(to: string, message: string): Promise<void> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID')!;
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN')!;
    const from = this.config.get<string>('TWILIO_FROM_NUMBER')!;

    const body = new URLSearchParams({ From: from, To: to, Body: message });
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      body.toString(),
      {
        auth: { username: sid, password: token },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000,
      },
    );
    this.logger.debug(`Twilio → ${to}`);
  }
}
