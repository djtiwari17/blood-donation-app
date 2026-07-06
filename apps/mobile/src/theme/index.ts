export const colors = {
  primary: '#E53935',
  primaryLight: '#FB6A6A',
  primaryPale: '#FFCDD2',
  primaryDark: '#B71C1C',
  secondary: '#1565C0',
  success: '#2E7D32',
  successLight: '#E8F5E9',
  warning: '#F57F17',
  warningLight: '#FFF8E1',
  error: '#C62828',
  gray: '#757575',
  grayLight: '#BDBDBD',
  grayPale: '#F5F5F5',
  white: '#FFFFFF',
  black: '#212121',
  textPrimary: '#212121',
  textSecondary: '#616161',
  textHint: '#9E9E9E',
  border: '#E0E0E0',
  cardBg: '#FFFFFF',
  screenBg: '#F5F5F5',
  urgentBg: '#FFEBEE',
  highBg: '#FFF3E0',
  mediumBg: '#FFFDE7',
};

export const fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    huge: 36,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
};

export const urgencyColors: Record<string, { bg: string; text: string; border: string }> = {
  Urgent: { bg: '#FFEBEE', text: '#C62828', border: '#EF9A9A' },
  High:   { bg: '#FFF3E0', text: '#E65100', border: '#FFCC80' },
  Medium: { bg: '#FFFDE7', text: '#F57F17', border: '#FFE082' },
  Low:    { bg: '#E8F5E9', text: '#2E7D32', border: '#A5D6A7' },
};

export const bloodGroupColors: Record<string, string> = {
  'A+': '#E53935', 'A-': '#C62828',
  'B+': '#1565C0', 'B-': '#0D47A1',
  'O+': '#2E7D32', 'O-': '#1B5E20',
  'AB+': '#6A1B9A', 'AB-': '#4A148C',
};
