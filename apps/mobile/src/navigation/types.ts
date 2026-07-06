export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  OTP: { phoneNumber: string };
  Registration: { phoneNumber: string };
  RoleSelection: { fullName: string; bloodGroup: string; city: string; phoneNumber: string };
  DonorProfileSetup: { fullName: string; bloodGroup: string; city: string; phoneNumber: string };
  VerificationPending: undefined;
};

export type DonorHomeStackParamList = {
  DonorDashboard: undefined;
  NearbyRequests: undefined;
  RequestDetails: { requestId: string };
  Notifications: undefined;
  ReportUser: { userId: string; userName: string };
  VerificationPendingDonor: undefined;
};

export type DonorHistoryStackParamList = {
  DonationHistory: undefined;
};

export type DonorProfileStackParamList = {
  DonorProfile: undefined;
  DonorProfileEdit: undefined;
  Notifications: undefined;
  ReportUser: { userId: string; userName: string };
  VerificationPendingDonor: undefined;
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

export type ReceiverProfileStackParamList = {
  ReceiverProfile: undefined;
  Notifications: undefined;
  ReportUser: { userId: string; userName: string };
};
