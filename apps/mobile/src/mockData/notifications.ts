import { Notification } from '../types';

export const mockNotifications: Notification[] = [
  { id: 'n1',  type: 'new_donor',       title: 'New donor found for your request!', message: 'Rahul Sharma (A+) is near you and can donate.', timestamp: '2024-01-10T10:30:00', timeAgo: '5 min ago',   isRead: false, relatedId: 'd1' },
  { id: 'n2',  type: 'request_accepted',title: 'Rahul Sharma accepted your request', message: 'A donor has agreed to donate blood for your patient.', timestamp: '2024-01-10T10:20:00', timeAgo: '15 min ago',  isRead: false, relatedId: 'r1' },
  { id: 'n3',  type: 'request_approved',title: 'Your request is approved', message: 'Blood request REQ123456 has been approved by the hospital.', timestamp: '2024-01-10T09:45:00', timeAgo: '1 hr ago',    isRead: false, relatedId: 'r1' },
  { id: 'n4',  type: 'reminder',        title: 'Reminder: You have an active request', message: 'Your request for A+ blood is still active. Donors are being notified.', timestamp: '2024-01-10T08:00:00', timeAgo: '2 hr ago',    isRead: true,  relatedId: 'r1' },
  { id: 'n5',  type: 'new_request',     title: 'New blood request near you', message: 'SMS Hospital needs A+ blood (2 units). 1.2 km away.', timestamp: '2024-01-10T07:30:00', timeAgo: '2.5 hr ago',  isRead: true,  relatedId: 'r1' },
  { id: 'n6',  type: 'new_donor',       title: 'Vikram Singh can donate!', message: 'B+ donor (2.1 km away) responded to your request.', timestamp: '2024-01-10T07:00:00', timeAgo: '3 hr ago',    isRead: true,  relatedId: 'd2' },
  { id: 'n7',  type: 'request_accepted',title: 'Amit Kumar accepted your request', message: 'An O+ donor is on his way to SMS Hospital.', timestamp: '2024-01-09T18:00:00', timeAgo: '16 hr ago',   isRead: true,  relatedId: 'r3' },
  { id: 'n8',  type: 'request_approved',title: 'Donation completed!', message: 'Blood donation for patient Mahesh Gupta has been completed.', timestamp: '2024-01-09T15:00:00', timeAgo: '19 hr ago',   isRead: true,  relatedId: 'r3' },
  { id: 'n9',  type: 'new_request',     title: 'Urgent: O- blood needed', message: 'City Hospital urgently needs O- blood. 2.6 km away.', timestamp: '2024-01-09T12:00:00', timeAgo: '22 hr ago',   isRead: true,  relatedId: 'r18' },
  { id: 'n10', type: 'reminder',        title: 'Profile verification pending', message: 'Complete your profile verification to unlock all features.', timestamp: '2024-01-09T10:00:00', timeAgo: '1 day ago',   isRead: true,  relatedId: undefined },
  { id: 'n11', type: 'new_donor',       title: '5 donors found for your request!', message: 'We found matching donors near Noble Hospital.', timestamp: '2024-01-09T09:00:00', timeAgo: '1 day ago',   isRead: true,  relatedId: 'r2' },
  { id: 'n12', type: 'request_accepted',title: 'Neha Gupta accepted to donate', message: 'A- donor agreed to donate for your patient.', timestamp: '2024-01-08T20:00:00', timeAgo: '2 days ago',  isRead: true,  relatedId: 'd5' },
  { id: 'n13', type: 'new_request',     title: 'AB+ blood needed urgently', message: 'Fortis Hospital needs AB+ blood (3 units). Very urgent!', timestamp: '2024-01-08T16:00:00', timeAgo: '2 days ago',  isRead: true,  relatedId: 'r4' },
  { id: 'n14', type: 'request_approved',title: 'Your request was completed', message: 'Blood request for patient Kamal Kishore has been fulfilled.', timestamp: '2024-01-08T14:00:00', timeAgo: '2 days ago',  isRead: true,  relatedId: 'r10' },
  { id: 'n15', type: 'reminder',        title: 'You can donate again!', message: 'It has been 3 months since your last donation. You are eligible to donate.', timestamp: '2024-01-07T09:00:00', timeAgo: '3 days ago',  isRead: true,  relatedId: undefined },
  { id: 'n16', type: 'new_request',     title: 'B- blood needed near you', message: 'Noble Hospital needs B- blood (1 unit). 3.0 km away.', timestamp: '2024-01-06T11:00:00', timeAgo: '4 days ago',  isRead: true,  relatedId: 'r17' },
  { id: 'n17', type: 'new_donor',       title: 'Priya Mehta is available to donate', message: 'A B- donor nearby responded to an urgent request.', timestamp: '2024-01-05T15:00:00', timeAgo: '5 days ago',  isRead: true,  relatedId: 'd6' },
  { id: 'n18', type: 'request_accepted',title: 'Sagar Patel saved a life!', message: 'AB+ donation for Ratan Singh was successful.', timestamp: '2024-01-05T12:00:00', timeAgo: '5 days ago',  isRead: true,  relatedId: 'r4' },
  { id: 'n19', type: 'reminder',        title: 'Blood drive event near you', message: 'AIIMS Jaipur is organizing a blood drive this Saturday. Register now!', timestamp: '2024-01-04T10:00:00', timeAgo: '6 days ago',  isRead: true,  relatedId: undefined },
  { id: 'n20', type: 'new_request',     title: 'New blood request in your area', message: 'SMS Hospital needs O+ blood (2 units). Only 1.5 km away.', timestamp: '2024-01-03T09:00:00', timeAgo: '1 week ago',  isRead: true,  relatedId: 'r8' },
];

export const getUnreadCount = () =>
  mockNotifications.filter(n => !n.isRead).length;
