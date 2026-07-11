// Human-readable labels for raw backend enum values (O_POS, CRITICAL,
// PARTIALLY_FULFILLED, …). Every formatter accepts either the raw code or an
// already-formatted label and returns the label, so call sites don't need to
// care which form they hold.

const BLOOD_GROUP_LABELS: Record<string, string> = {
  A_POS: 'A+', A_NEG: 'A-', B_POS: 'B+', B_NEG: 'B-',
  AB_POS: 'AB+', AB_NEG: 'AB-', O_POS: 'O+', O_NEG: 'O-',
};

export const formatBloodGroup = (value?: string | null): string =>
  value ? (BLOOD_GROUP_LABELS[value] ?? value) : '';

const URGENCY_LABELS: Record<string, string> = {
  CRITICAL: 'Urgent', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low',
};

export const formatUrgency = (value?: string | null): string =>
  value ? (URGENCY_LABELS[value] ?? value) : '';

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PARTIALLY_FULFILLED: 'Donor Found',
  FULFILLED: 'Fulfilled',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export const formatRequestStatus = (value?: string | null): string =>
  value ? (REQUEST_STATUS_LABELS[value] ?? value.replace(/_/g, ' ')) : '';

const MATCH_STATUS_LABELS: Record<string, string> = {
  NOTIFIED: 'Awaiting Response',
  ACCEPTED: 'Accepted',
  DONATED: 'Donated',
  CANCELLED: 'Declined',
  TIMED_OUT: 'No Response',
};

export const formatMatchStatus = (value?: string | null): string =>
  value ? (MATCH_STATUS_LABELS[value] ?? value.replace(/_/g, ' ')) : '';

// "+91XXXXXXXXXX" → "+91 XXXXXXXXXX"
export const formatPhone = (value?: string | null): string =>
  value ? value.replace(/^\+91(?=\d)/, '+91 ') : '';
