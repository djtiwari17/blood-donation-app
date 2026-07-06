import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtRefreshPayload {
  sub: string;
  jti: string;
  type: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    const publicKeyB64 = config.get<string>('JWT_PUBLIC_KEY') ?? '';
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      secretOrKey: Buffer.from(publicKeyB64, 'base64').toString('utf-8'),
      algorithms: ['RS256'],
      passReqToCallback: true,
    });
  }

  validate(req: any, payload: JwtRefreshPayload) {
    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');
    req.rawRefreshToken = req.body?.refreshToken as string;
    return payload;
  }
}
