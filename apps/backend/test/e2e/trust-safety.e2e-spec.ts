/**
 * Layer 3/4 — E2E: Trust & Safety
 *
 * Covers:
 *   FR-20/21 (report user), BR-07 (auto-suspend at 3 reports),
 *   BR-08 (suspended user cannot receive matches),
 *   Edge case EC-08 (user reports themself)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';

const SKIP = !process.env.DATABASE_URL || !process.env.REDIS_URL;

(SKIP ? describe.skip : describe)('E2E: Trust & Safety — 3-report auto-suspend', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await prisma.bloodMatch.deleteMany({});
    await prisma.report.deleteMany({});
    await prisma.bloodRequest.deleteMany({});
    await prisma.donorProfile.deleteMany({});
    await prisma.otpVerif.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({ where: { phone: { startsWith: '+77' } } });
  });

  async function loginAs(phone: string, name: string, role: string): Promise<string> {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('000000', 10);
    const redis = (app as any).get?.('REDIS');
    await redis.setex(`otp:${phone}`, 300, JSON.stringify({ hash, attempts: 0 }));

    const verify = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ phone, code: '000000' })
      .expect(201);

    if (verify.body.isNewUser) {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ otpSession: verify.body.otpSession, name, bloodGroup: 'B+', role });
      return reg.body.accessToken;
    }
    return verify.body.accessToken;
  }

  it('BR-07: user is auto-suspended and blocked after 3 reports', async () => {
    // Create the reported donor
    const targetUser = await prisma.user.create({
      data: { phone: '+7790000099', name: 'Bad Actor', bloodGroup: 'O_POS', role: 'DONOR' },
    });

    // Three different reporters
    const tokens = await Promise.all([
      loginAs('+7790000001', 'Reporter 1', 'DONOR'),
      loginAs('+7790000002', 'Reporter 2', 'DONOR'),
      loginAs('+7790000003', 'Reporter 3', 'DONOR'),
    ]);

    // Report 1
    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${tokens[0]}`)
      .send({ reportedUserId: targetUser.id, reason: 'SPAM' })
      .expect(201);

    // Report 2
    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${tokens[1]}`)
      .send({ reportedUserId: targetUser.id, reason: 'FAKE_PROFILE' })
      .expect(201);

    // Report 3 — should trigger auto-suspend
    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${tokens[2]}`)
      .send({ reportedUserId: targetUser.id, reason: 'WRONG_INFO' })
      .expect(201);

    // Verify user is suspended and blocked in DB
    const updated = await prisma.user.findUnique({ where: { id: targetUser.id } });
    expect(updated?.verifStatus).toBe('SUSPENDED');
    expect(updated?.isBlocked).toBe(true);
  });

  it('BR-07: auto-suspend cancels all NOTIFIED matches for the suspended donor', async () => {
    const targetUser = await prisma.user.create({
      data: { phone: '+7790000098', name: 'Donor With Matches', bloodGroup: 'A_POS', role: 'DONOR' },
    });
    const donorProfile = await prisma.donorProfile.create({
      data: { userId: targetUser.id },
    });

    // Create a blood request for another user
    const receiverUser = await prisma.user.create({
      data: { phone: '+7790000097', name: 'Receiver', bloodGroup: 'A_POS', role: 'RECEIVER' },
    });
    const bloodReq = await prisma.bloodRequest.create({
      data: {
        requestCode: 'BD061600TEST',
        receiverId: receiverUser.id,
        patientName: 'Patient',
        hospitalName: 'Hospital',
        bloodGroup: 'A_POS',
        unitsNeeded: 1,
        urgency: 'MEDIUM',
        requiredBy: new Date(Date.now() + 86400000),
        expiresAt: new Date(Date.now() + 172800000),
      },
    });

    // Create NOTIFIED match
    await prisma.bloodMatch.create({
      data: {
        requestId: bloodReq.id,
        donorProfileId: donorProfile.id,
        status: 'NOTIFIED',
        distanceKm: 3.5,
        score: 80,
        timeoutAt: new Date(Date.now() + 7200000),
      },
    });

    // Trigger 3 reports
    const tokens = await Promise.all([
      loginAs('+7790000010', 'R1', 'DONOR'),
      loginAs('+7790000011', 'R2', 'DONOR'),
      loginAs('+7790000012', 'R3', 'DONOR'),
    ]);

    for (const token of tokens) {
      await request(app.getHttpServer())
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ reportedUserId: targetUser.id, reason: 'SPAM' })
        .expect(201);
    }

    // Match should now be CANCELLED
    const match = await prisma.bloodMatch.findFirst({ where: { donorProfileId: donorProfile.id } });
    expect(match?.status).toBe('CANCELLED');
    expect(match?.cancelReason).toBe('Account suspended');
  });

  it('EC-08: self-report returns 400', async () => {
    const token = await loginAs('+7790000020', 'Self Reporter', 'DONOR');
    const me = await prisma.user.findUnique({ where: { phone: '+7790000020' } });

    const res = await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ reportedUserId: me!.id, reason: 'SPAM' })
      .expect(400);

    expect(res.body.message).toContain('yourself');
  });

  it('duplicate report by same reporter returns 409', async () => {
    const targetUser = await prisma.user.create({
      data: { phone: '+7790000096', name: 'Dup Target', bloodGroup: 'B_POS', role: 'DONOR' },
    });
    const token = await loginAs('+7790000030', 'Dup Reporter', 'DONOR');

    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ reportedUserId: targetUser.id, reason: 'SPAM' })
      .expect(201);

    // Second report to same target
    await request(app.getHttpServer())
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ reportedUserId: targetUser.id, reason: 'HARASSMENT' })
      .expect(409);
  });
});
