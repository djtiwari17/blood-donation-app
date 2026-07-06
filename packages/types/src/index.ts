// =============================================================================
// Shared types used by both apps/mobile and apps/backend
// Primitive enums and DTOs — no framework-specific imports
// =============================================================================

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type UserRole = 'DONOR' | 'RECEIVER' | 'DONOR_RECEIVER' | 'ADMIN' | 'SUPER_ADMIN';
export type VerifStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RequestStatus = 'PENDING' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED';
export type MatchStatus = 'NOTIFIED' | 'ACCEPTED' | 'DONATED' | 'CANCELLED' | 'TIMED_OUT';

export interface UserDto {
  id: string;
  phone: string;
  name: string;
  email?: string;
  bloodGroup: BloodGroup;
  gender?: Gender;
  dateOfBirth?: string;
  city?: string;
  area?: string;
  role: UserRole;
  verifStatus: VerifStatus;
  createdAt: string;
  [key: string]: unknown;
}

export interface DonorProfileDto {
  id: string;
  userId: string;
  isAvailable: boolean;
  lastDonationDate?: string;
  nextEligibleDate?: string;
  totalDonations: number;
  livesSaved: number;
  locationLat?: number;
  locationLng?: number;
}

export interface BloodRequestDto {
  id: string;
  requestCode: string;
  patientName: string;
  hospitalName: string;
  hospitalLat?: number;
  hospitalLng?: number;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  unitsFulfilled: number;
  urgency: UrgencyLevel;
  requiredBy: string;
  status: RequestStatus;
  createdAt: string;
}

export interface MatchedDonorDto {
  matchId: string;
  userId: string;
  name: string;
  bloodGroup: BloodGroup;
  distanceKm: number;
  totalDonations: number;
  isVerified: boolean;
  phone: string; // masked unless matchStatus === 'ACCEPTED'
  matchStatus: MatchStatus;
  score: number;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  relatedId?: string;
  createdAt: string;
}

// ABO/Rh compatibility matrix — source of truth (no derivation in UI)
export const BLOOD_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+':  ['O+', 'O-'],
  'O-':  ['O-'],
};

export const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const DONOR_MIN_AGE = 18;
export const DONOR_MAX_AGE = 65;
export const DONATION_INTERVAL_DAYS = 56;
export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_LOCKOUT_MINUTES = 30;
export const MATCH_TIMEOUT_HOURS = 2;
