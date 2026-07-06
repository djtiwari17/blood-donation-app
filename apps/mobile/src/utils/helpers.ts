import { BloodGroup, UrgencyLevel } from '../types';

export const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const URGENCY_LEVELS: UrgencyLevel[] = ['Urgent', 'High', 'Medium', 'Low'];

export const CITIES = ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Alwar'];

export const HOSPITALS = [
  'SMS Hospital, Jaipur',
  'Noble Hospital, Jaipur',
  'City Hospital, Jaipur',
  'Fortis Hospital, Jaipur',
  'Apollo Hospital, Jaipur',
  'AIIMS Jaipur',
  'Narayana Hospital, Jaipur',
  'Manipal Hospital, Jaipur',
  'Santokba Durlabhji Hospital',
  'Mahatma Gandhi Hospital',
];

export const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
};

export const formatDistance = (km: number): string => {
  if (km < 1) return `${(km * 1000).toFixed(0)} m away`;
  return `${km.toFixed(1)} km away`;
};

export const generateRequestId = (): string => {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `REQ${num}`;
};

export const validatePhone = (phone: string): boolean =>
  /^[6-9]\d{9}$/.test(phone.replace(/\s/g, '').replace('+91', '').replace('-', ''));

export const validateName = (name: string): boolean => name.trim().length >= 2;
