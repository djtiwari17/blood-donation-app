export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';
export type UserRole = 'donor' | 'receiver';
export type UrgencyLevel = 'Urgent' | 'High' | 'Medium' | 'Low';
export type RequestStatus = 'Pending' | 'Approved' | 'Completed' | 'Cancelled';
export type DonationStatus = 'Completed' | 'Cancelled' | 'Pending';
export type Gender = 'Male' | 'Female' | 'Other';

export interface User {
  id: string;
  fullName: string;
  phoneNumber: string;
  bloodGroup: BloodGroup;
  city: string;
  role: UserRole;
  avatar?: string;
  isVerified: boolean;
  dateOfBirth?: string;
  gender?: Gender;
  availability?: boolean;
  lastDonation?: string;
  totalDonations?: number;
}

export interface Donor {
  id: string;
  fullName: string;
  phoneNumber: string;
  bloodGroup: BloodGroup;
  city: string;
  area: string;
  distance: number;
  isAvailable: boolean;
  isVerified: boolean;
  totalDonations: number;
  lastDonation: string;
  gender: Gender;
  dateOfBirth: string;
  avatar?: string;
}

export interface BloodRequest {
  id: string;
  requestId: string;
  patientName: string;
  hospitalName: string;
  location: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  urgency: UrgencyLevel;
  requiredBy: string;
  contactPerson: string;
  contactPhone: string;
  status: RequestStatus;
  distance: number;
  createdAt: string;
  postedAgo: string;
  receiverId: string;
  matchingDonors?: string[];
}

export interface Notification {
  id: string;
  type: 'new_donor' | 'request_accepted' | 'request_approved' | 'reminder' | 'new_request';
  title: string;
  message: string;
  timestamp: string;
  timeAgo: string;
  isRead: boolean;
  relatedId?: string;
}

export interface DonationRecord {
  id: string;
  date: string;
  bloodGroup: BloodGroup;
  hospitalName: string;
  city: string;
  units: number;
  status: DonationStatus;
  patientName?: string;
}
