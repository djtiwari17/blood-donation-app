import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const privateKeyB64 = config.get<string>('JWT_PRIVATE_KEY') ?? '';
        const publicKeyB64 = config.get<string>('JWT_PUBLIC_KEY') ?? '';
        return {
          privateKey: Buffer.from(privateKeyB64, 'base64').toString('utf-8'),
          publicKey: Buffer.from(publicKeyB64, 'base64').toString('utf-8'),
          signOptions: { algorithm: 'RS256' },
        };
      },
    }),
  ],
  providers: [
    AuthService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    JwtRefreshGuard,
  ],
  controllers: [AuthController],
  exports: [JwtAuthGuard, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
