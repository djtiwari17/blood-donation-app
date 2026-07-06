import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

export interface JwtAccessPayload {
  sub: string;
  phone: string;
  role: string;
  type: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    const publicKeyB64 = config.get<string>('JWT_PUBLIC_KEY') ?? '';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: Buffer.from(publicKeyB64, 'base64').toString('utf-8'),
      algorithms: ['RS256'],
    });
  }

  async validate(payload: JwtAccessPayload) {
    if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.isBlocked || user.deletedAt) throw new UnauthorizedException();
    return user;
  }
}
