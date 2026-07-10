import { BloodGroup, UrgencyLevel } from '../types';

export const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const URGENCY_LEVELS: UrgencyLevel[] = ['Urgent', 'High', 'Medium', 'Low'];

// All 28 states + 8 union territories. City selection is a live search
// (see geocodingApi.searchCities) scoped to whichever state is picked here,
// rather than a static list — India has far too many towns to hand-maintain
// accurately.
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
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
