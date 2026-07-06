import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, HttpException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ChainSmsProvider } from '../sms/providers/chain.provider';

// Minimal mocks — only what the tests actually need
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  otpVerif: { create: jest.fn() },
};

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

const mockSms = { send: jest.fn() };

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn(),
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, unknown> = {
      'app.rateLimit.sendOtpPerHour': 5,
      SMS_PROVIDER: 'console',
    };
    return map[key];
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ChainSmsProvider, useValue: mockSms },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  // ── sendOtp ─────────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('sends OTP and stores hash in Redis', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.setex.mockResolvedValue('OK');
      mockSms.send.mockResolvedValue(undefined);

      await expect(service.sendOtp('+919876543210')).resolves.toBeUndefined();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'otp:+919876543210',
        300,
        expect.stringContaining('"attempts":0'),
      );
      expect(mockSms.send).toHaveBeenCalledWith('+919876543210', expect.any(String));
    });

    it('throws 429 after exceeding rate limit', async () => {
      mockRedis.incr.mockResolvedValue(6); // over limit of 5
      await expect(service.sendOtp('+919876543210')).rejects.toBeInstanceOf(HttpException);
    });
  });

  // ── verifyOtp ────────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    const phone = '+919876543210';

    it('throws 429 when account is locked', async () => {
      mockRedis.get.mockImplementation((key: string) =>
        key === `otp:lock:${phone}` ? '1' : null,
      );
      await expect(service.verifyOtp(phone, '123456')).rejects.toBeInstanceOf(HttpException);
    });

    it('throws 401 when OTP not found in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);
      await expect(service.verifyOtp(phone, '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('increments attempts on wrong OTP and throws 401', async () => {
      // Store a hash for code '999999' so '123456' is wrong
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('999999', 10);
      mockRedis.get.mockImplementation((key: string) => {
        if (key === `otp:lock:${phone}`) return null;
        if (key === `otp:${phone}`) return JSON.stringify({ hash, attempts: 0 });
        return null;
      });
      mockRedis.setex.mockResolvedValue('OK');
      await expect(service.verifyOtp(phone, '123456')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `otp:${phone}`, 300, expect.stringContaining('"attempts":1'),
      );
    });

    it('locks account after 3 failed attempts', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('999999', 10);
      mockRedis.get.mockImplementation((key: string) => {
        if (key === `otp:lock:${phone}`) return null;
        if (key === `otp:${phone}`) return JSON.stringify({ hash, attempts: 2 });
        return null;
      });
      mockRedis.del.mockResolvedValue(1);
      mockRedis.setex.mockResolvedValue('OK');

      await expect(service.verifyOtp(phone, '123456')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mockRedis.setex).toHaveBeenCalledWith(`otp:lock:${phone}`, 1800, '1');
    });

    it('returns isNewUser:true and otpSession for unknown phone', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('123456', 10);
      mockRedis.get.mockImplementation((key: string) => {
        if (key === `otp:lock:${phone}`) return null;
        if (key === `otp:${phone}`) return JSON.stringify({ hash, attempts: 0 });
        return null;
      });
      mockRedis.del.mockResolvedValue(1);
      mockRedis.setex.mockResolvedValue('OK');
      mockPrisma.user.findUnique.mockResolvedValue(null); // unknown user

      const result = await service.verifyOtp(phone, '123456');
      expect(result).toMatchObject({ isNewUser: true, otpSession: expect.any(String) });
    });

    it('returns tokens for existing user', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('123456', 10);
      mockRedis.get.mockImplementation((key: string) => {
        if (key === `otp:lock:${phone}`) return null;
        if (key === `otp:${phone}`) return JSON.stringify({ hash, attempts: 0 });
        return null;
      });
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid', phone, role: 'DONOR', isBlocked: false, deletedAt: null,
      });
      mockPrisma.otpVerif.create.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'mock-jti' });

      const result = await service.verifyOtp(phone, '123456');
      expect(result).toMatchObject({ isNewUser: false, accessToken: expect.any(String) });
    });
  });

  // ── register ─────────────────────────────────────────────────────────────────

  describe('register', () => {
    const phone = '+919876543210';

    function makeOtpSession() {
      // mockJwt.sign returns 'mock.jwt.token'; verify must succeed with correct payload
      mockJwt.verify.mockReturnValue({ phone, type: 'otp_session' });
    }

    it('throws 401 when otpSession JWT is invalid', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('jwt expired'); });
      await expect(service.register({ otpSession: 'bad.token', name: 'Ravi', bloodGroup: 'A+' } as any))
        .rejects.toBeInstanceOf(Error);
    });

    it('throws 401 when pending OTP session not found in Redis', async () => {
      makeOtpSession();
      mockRedis.get.mockResolvedValue(null); // session expired

      await expect(service.register({ otpSession: 'valid', name: 'Ravi', bloodGroup: 'A+' } as any))
        .rejects.toBeInstanceOf(Error);
    });

    it('throws 409 when phone is already registered', async () => {
      makeOtpSession();
      mockRedis.get.mockResolvedValue('1'); // pending session present
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user', phone }); // already exists

      const { ConflictException } = require('@nestjs/common');
      await expect(service.register({ otpSession: 'valid', name: 'Ravi', bloodGroup: 'A+' } as any))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('creates user and returns tokens for valid otpSession', async () => {
      makeOtpSession();
      mockRedis.get.mockResolvedValue('1');
      mockPrisma.user.findUnique.mockResolvedValue(null); // new phone
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-id', phone, name: 'Ravi', role: 'DONOR',
        bloodGroup: 'A_POS', verifStatus: 'UNVERIFIED', isBlocked: false, deletedAt: null,
      });
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.otpVerif.create.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'token-jti' });

      const result = await service.register({
        otpSession: 'valid',
        name: 'Ravi Kumar',
        bloodGroup: 'A+',
        role: 'DONOR',
      } as any);

      expect(result).toMatchObject({ accessToken: expect.any(String), user: expect.any(Object) });
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone, name: 'Ravi Kumar' }),
        }),
      );
    });
  });
});
