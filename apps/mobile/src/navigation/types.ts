import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  OTP: { phoneNumber: string };
  Registration: { phoneNumber: string };
  RoleSelection: { fullName: string; bloodGroup: string; city: string; phoneNumber: string };
  DonorProfileSetup: { fullName: string; bloodGroup: string; city: string; phoneNumber: string };
};

export type DonorHomeStackParamList = {
  DonorDashboard: undefined;
  NearbyRequests: undefined;
  MapView: undefined;
  RequestDetails: { requestId: string };
  Notifications: undefined;
  ReportUser: { userId: string; userName: string };
  // Blood-request flow, reachable from the donor home "Request Blood" CTA for
  // DONOR_RECEIVER users. Reuses the receiver request screens/param list.
  RequestFlow: NavigatorScreenParams<ReceiverHomeStackParamList>;
};

export type DonorHistoryStackParamList = {
  DonationHistory: undefined;
};

export type DonorProfileStackParamList = {
  DonorProfile: undefined;
  Notifications: undefined;
  ReportUser: { userId: string; userName: string };
};

export type ReceiverHomeStackParamList = {
  ReceiverDashboard: undefined;
  CreateRequest: undefined;
  RequestSubmitted: { requestId: string };
  MatchingDonors: { requestId: string };
  RequestStatus: { requestId: string };
  Notifications: undefined;
  ReportUser: { userId: string; userName: string };
};

export type ReceiverNotificationsStackParamList = {
  Notifications: undefined;
};

export type ReceiverProfileStackParamList = {
  ReceiverProfile: undefined;
  Notifications: undefined;
  ReportUser: { userId: string; userName: string };
};
