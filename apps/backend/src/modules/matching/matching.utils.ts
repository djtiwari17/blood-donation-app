// Pure matching logic extracted for testability

// Donor blood groups compatible with each recipient blood group (Blueprint §4.2)
export const BLOOD_COMPATIBILITY: Record<string, string[]> = {
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+':  ['O+', 'O-'],
  'O-':  ['O-'],
};

export type EscalationStage = {
  radius: number;
  threshold: number;
  nextRadius: number | null;
  nextDelayMs: number;
};

// Standard escalation: 10→25→50→100→200km (Blueprint §4.2)
export const STANDARD_ESCALATION: EscalationStage[] = [
  { radius: 10,  threshold: 3, nextRadius: 25,  nextDelayMs: 2 * 3600 * 1000 },
  { radius: 25,  threshold: 2, nextRadius: 50,  nextDelayMs: 2 * 3600 * 1000 },
  { radius: 50,  threshold: 1, nextRadius: 100, nextDelayMs: 4 * 3600 * 1000 },
  { radius: 100, threshold: 1, nextRadius: 200, nextDelayMs: 16 * 3600 * 1000 },
  { radius: 200, threshold: 0, nextRadius: null, nextDelayMs: 0 },
];

// CRITICAL escalation: start at 50km, jump to 200km at T+30min (Blueprint §4.2)
export const CRITICAL_ESCALATION: EscalationStage[] = [
  { radius: 50,  threshold: 1, nextRadius: 200, nextDelayMs: 30 * 60 * 1000 },
  { radius: 200, threshold: 0, nextRadius: null, nextDelayMs: 0 },
];

export function scoreMatch(
  distanceKm: number,
  radiusKm: number,
  donor: { totalDonations: number; responseRate: number; verifStatus: string },
): number {
  const distanceScore = Math.max(0, 40 - Math.floor((distanceKm / radiusKm) * 40));
  const availScore = 20; // only available donors reach this function
  const verifScore =
    donor.verifStatus === 'VERIFIED' ? 20 :
    donor.verifStatus === 'PENDING'  ? 10 : 0;
  const expScore =
    donor.totalDonations >= 6 ? 10 :
    donor.totalDonations >= 3 ? 7  :
    donor.totalDonations >= 1 ? 4  : 0;
  const rateScore = Math.round(donor.responseRate * 10);
  return distanceScore + availScore + verifScore + expScore + rateScore;
}
