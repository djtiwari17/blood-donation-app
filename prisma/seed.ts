/**
 * DEV-ONLY SEED SCRIPT
 * Creates test data for local development.
 * NEVER runs in production — guarded by NODE_ENV and DATABASE_URL checks.
 *
 * Usage: npm run db:seed  (from repo root)
 */

import { PrismaClient, BloodGroup, UserRole, VerifStatus, UrgencyLevel, RequestStatus } from '@prisma/client';

const prisma = new PrismaClient();

function guard() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Seed refused: NODE_ENV is not "development"');
  }
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    throw new Error('Seed refused: DATABASE_URL does not point to localhost. Aborting to protect remote data.');
  }
}

// Reserved phone range +9100000XXXXX — unassignable, safe for test data
function testPhone(n: number) {
  return `+9100000${String(n).padStart(5, '0')}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  guard();
  console.log('Seeding dev database...');

  // Wipe in reverse FK order
  await prisma.bloodMatch.deleteMany();
  await prisma.bloodRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.donorProfile.deleteMany();
  await prisma.user.deleteMany();

  // ── Admin ──────────────────────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      phone: testPhone(1),
      name: 'Dev Admin',
      bloodGroup: BloodGroup.O_POS,
      role: UserRole.SUPER_ADMIN,
      verifStatus: VerifStatus.VERIFIED,
    },
  });

  // ── Donors (10) — Jaipur coordinates with variance ────────────────────────
  const JAIPUR_LAT = 26.9124;
  const JAIPUR_LNG = 75.7873;
  const bloodGroups = Object.values(BloodGroup);

  const donors = await Promise.all(
    Array.from({ length: 10 }, async (_, i) => {
      const bg = bloodGroups[i % bloodGroups.length];
      const lastDonation = i < 5 ? addDays(new Date(), -(60 + i * 10)) : null;

      const user = await prisma.user.create({
        data: {
          phone: testPhone(10 + i),
          name: `Test Donor ${i + 1}`,
          bloodGroup: bg,
          gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
          dateOfBirth: new Date(1990 + i, i % 12, 1),
          city: 'Jaipur',
          area: ['Malviya Nagar', 'Vaishali Nagar', 'Mansarovar', 'C-Scheme', 'Raja Park'][i % 5],
          role: UserRole.DONOR,
          verifStatus: i < 8 ? VerifStatus.VERIFIED : VerifStatus.PENDING,
          donorProfile: {
            create: {
              isAvailable: i < 7,
              lastDonationDate: lastDonation,
              locationLat: JAIPUR_LAT + (Math.random() - 0.5) * 0.1,
              locationLng: JAIPUR_LNG + (Math.random() - 0.5) * 0.1,
              totalDonations: i * 2,
              livesSaved: i * 6,
            },
          },
        },
      });

      // Update GEOGRAPHY column via raw SQL
      await prisma.$executeRaw`
        UPDATE donor_profiles
        SET location = ST_SetSRID(ST_MakePoint(
          ${JAIPUR_LNG + (Math.random() - 0.5) * 0.1},
          ${JAIPUR_LAT + (Math.random() - 0.5) * 0.1}
        ), 4326)::geography
        WHERE user_id = ${user.id}::uuid
      `;

      return user;
    })
  );

  // ── Receivers (5) ────────────────────────────────────────────────────────
  const receivers = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      prisma.user.create({
        data: {
          phone: testPhone(20 + i),
          name: `Test Receiver ${i + 1}`,
          bloodGroup: bloodGroups[(i + 2) % bloodGroups.length],
          city: 'Jaipur',
          role: UserRole.RECEIVER,
          verifStatus: VerifStatus.VERIFIED,
        },
      })
    )
  );

  // ── Blood requests ────────────────────────────────────────────────────────
  const urgencies = Object.values(UrgencyLevel);
  await Promise.all(
    Array.from({ length: 5 }, (_, i) => {
      const requiredBy = addDays(new Date(), i + 1);
      return prisma.bloodRequest.create({
        data: {
          requestCode: `REQ00${100 + i}`,
          receiverId: receivers[i].id,
          patientName: `Patient ${i + 1}`,
          hospitalName: ['SMS Hospital', 'Fortis Jaipur', 'AIIMS Jaipur', 'Apollo', 'Noble'][i],
          hospitalLat: JAIPUR_LAT + (Math.random() - 0.5) * 0.05,
          hospitalLng: JAIPUR_LNG + (Math.random() - 0.5) * 0.05,
          bloodGroup: bloodGroups[i % bloodGroups.length],
          unitsNeeded: i + 1,
          urgency: urgencies[i % urgencies.length],
          requiredBy,
          expiresAt: addDays(requiredBy, 1),
          status: RequestStatus.PENDING,
        },
      });
    })
  );

  console.log(`Seeded: 1 admin, ${donors.length} donors, ${receivers.length} receivers, 5 blood requests`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
