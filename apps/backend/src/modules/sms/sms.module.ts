import { Global, Module } from '@nestjs/common';
import { ConsoleSmsProvider } from './providers/console.provider';
import { Msg91SmsProvider } from './providers/msg91.provider';
import { TwilioSmsProvider } from './providers/twilio.provider';
import { ChainSmsProvider } from './providers/chain.provider';

@Global()
@Module({
  providers: [ConsoleSmsProvider, Msg91SmsProvider, TwilioSmsProvider, ChainSmsProvider],
  exports: [ChainSmsProvider],
})
export class SmsModule {}
