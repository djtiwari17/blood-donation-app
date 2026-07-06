import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BloodGroup, Gender, SmsProvider, UserRole } from '@prisma/client';
import { createHash, randomInt, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ChainSmsProvider } from '../sms/providers/chain.provider';
import { RegisterDto } from './dto/register.dto';

const BG_MAP: Record<string, BloodGroup> = {
  'A+': BloodGroup.A_POS, 'A-': BloodGroup.A_NEG,
  'B+': BloodGroup.B_POS, 'B-': BloodGroup.B_NEG,
  'AB+': BloodGroup.AB_POS, 'AB-': BloodGroup.AB_NEG,
  'O+': BloodGroup.O_POS, 'O-': BloodGroup.O_NEG,
};

export type TokenPair = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sms: ChainSmsProvider,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Send OTP ────────────────────────────────────────────────────────────────

  async sendOtp(phone: string): Promise<void> {
    const maxSends = this.config.get<number>('app.rateLimit.sendOtpPerHour') ?? 5;
    const rateKey = `otp:rate:${phone}`;
    const sends = await this.redis.incr(rateKey);
    if (sends === 1) await this.redis.expire(rateKey, 3600);
    if (sends > maxSends) {
      throw new HttpException(
        `Too many OTP requests. Please wait before trying again.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(100_000, 1_000_000).toString().padStart(6, '0');
    const hash = await bcrypt.hash(code, 10);

    await this.redis.setex(`otp:${phone}`, 300, JSON.stringify({ hash, attempts: 0 }));

    const message = `${code} is your Blood Donation OTP. Valid for 5 mins. Do not share.`;
    await this.sms.send(phone, message);

    this.logger.log(`OTP sent to ${phone}`);
  }

  // ── Verify OTP ──────────────────────────────────────────────────────────────

  async verifyOtp(phone: string, code: string): Promise<
    | { isNewUser: true; otpSession: string }
    | { isNewUser: false; accessToken: string; refreshToken: string; user: object }
  > {
    // Lockout check
    const locked = await this.redis.get(`otp:lock:${phone}`);
    if (locked) {
      throw new HttpException(
        'Too many failed attempts. Account locked for 30 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const raw = await this.redis.get(`otp:${phone}`);
    if (!raw) {
      throw new UnauthorizedException('OTP expired or not requested. Request a new OTP.');
    }

    const { hash, attempts } = JSON.parse(raw) as { hash: string; attempts: number };
    const valid = await bcrypt.compare(code, hash);

    if (!valid) {
      const next = attempts + 1;
      if (next >= 3) {
        await this.redis.del(`otp:${phone}`);
        await this.redis.setex(`otp:lock:${phone}`, 1800, '1');
        throw new UnauthorizedException(
          'Too many failed attempts. Account locked for 30 minutes.',
        );
      }
      await this.redis.setex(`otp:${phone}`, 300, JSON.stringify({ hash, attempts: next }));
      const left = 3 - next;
      throw new UnauthorizedException(
        `Invalid OTP. ${left} attempt${left === 1 ? '' : 's'} remaining.`,
      );
    }

    await this.redis.del(`otp:${phone}`);

    const user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      const otpSession = this.jwt.sign(
        { phone, type: 'otp_session' },
        { expiresIn: '15m', algorithm: 'RS256' },
      );
      await this.redis.setex(`otp:pending:${phone}`, 900, '1');
      return { isNewUser: true, otpSession };
    }

    if (user.isBlocked) throw new UnauthorizedException('Your account has been suspended.');
    if (user.deletedAt) throw new UnauthorizedException('Account not found.');

    await this.logOtpVerification(user.id, phone);
    const tokens = await this.issueTokenPair(user.id, user.phone, user.role);
    return { isNewUser: false, ...tokens, user: this.sanitize(user) };
  }

  // ── Register ────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<TokenPair & { user: object }> {
    let sessionPayload: { phone: string; type: string };
    try {
      sessionPayload = this.jwt.verify(dto.otpSession, { algorithms: ['RS256'] }) as any;
    } catch {
      throw new UnauthorizedException('Invalid or expired session. Verify your phone again.');
    }
    if (sessionPayload.type !== 'otp_session') {
      throw new UnauthorizedException('Invalid session type.');
    }

    const { phone } = sessionPayload;

    const pending = await this.redis.get(`otp:pending:${phone}`);
    if (!pending) {
      throw new UnauthorizedException('OTP session expired. Verify your phone again.');
    }

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) throw new ConflictException('Phone number already registered.');

    const bloodGroup = BG_MAP[dto.bloodGroup];
    if (!bloodGroup) throw new HttpException('Invalid blood group', HttpStatus.BAD_REQUEST);

    const role = (dto.role ?? 'DONOR') as UserRole;

    const user = await this.prisma.user.create({
      data: {
        phone,
        name: dto.name,
        bloodGroup,
        gender: dto.gender as Gender | undefined,
        role,
        city: dto.city,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });

    await this.redis.del(`otp:pending:${phone}`);
    await this.logOtpVerification(user.id, phone);

    const tokens = await this.issueTokenPair(user.id, user.phone, user.role);
    return { ...tokens, user: this.sanitize(user) };
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────

  async refreshTokens(rawToken: string): Promise<TokenPair> {
    if (!rawToken) throw new UnauthorizedException('Refresh token required.');

    let payload: { sub: string; jti: string; type: string };
    try {
      payload = this.jwt.verify(rawToken, { algorithms: ['RS256'] }) as any;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type.');

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const stored = await this.prisma.refreshToken.findFirst({
      where: { id: payload.jti, userId: payload.sub, revokedAt: null },
    });
    if (!stored || stored.tokenHash !== tokenHash) {
      // Token reuse detected — revoke all tokens for this user (security measure)
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token already used or invalid.');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired. Please log in again.');
    }

    await this.prisma.refreshToken.update({
      where: { id: payload.jti },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.isBlocked || user.deletedAt) throw new UnauthorizedException();

    return this.issueTokenPair(user.id, user.phone, user.role);
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async issueTokenPair(userId: string, phone: string, role: string): Promise<TokenPair> {
    const accessTtl = parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10);
    const refreshTtl = parseInt(process.env.JWT_REFRESH_TTL ?? '604800', 10);

    // Generate jti upfront so we sign refresh token with it before creating DB record
    const jti = randomUUID();

    const accessToken = this.jwt.sign(
      { sub: userId, phone, role, type: 'access' },
      { expiresIn: accessTtl, algorithm: 'RS256' },
    );
    const refreshToken = this.jwt.sign(
      { sub: userId, jti, type: 'refresh' },
      { expiresIn: refreshTtl, algorithm: 'RS256' },
    );

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private async logOtpVerification(userId: string, phone: string): Promise<void> {
    const providerName = this.config.get<string>('SMS_PROVIDER') ?? 'console';
    const provider =
      providerName === 'msg91'
        ? SmsProvider.MSG91
        : providerName === 'twilio'
          ? SmsProvider.TWILIO
          : SmsProvider.CONSOLE;

    await this.prisma.otpVerif.create({
      data: { userId, phone, provider, verifiedAt: new Date() },
    });
  }

  private sanitize(user: Record<string, unknown>): object {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { deletedAt, ...safe } = user;
    return safe;
  }
}
