import { createNavigationContainerRef } from '@react-navigation/native';

// Shared ref so non-component code (push-notification tap handler) can navigate.
export const navigationRef = createNavigationContainerRef();

/**
 * Best-effort deep link from a tapped notification. Navigates to the most
 * relevant tab based on the notification type and the current user's role.
 * Wrapped defensively — an unknown route is a no-op rather than a crash.
 */
export function handleNotificationNavigation(
  type: string | undefined,
  relatedId: string | undefined,
  role: string | undefined,
) {
  if (!navigationRef.isReady()) return;
  // The container ref is untyped here; cast to keep navigate calls simple.
  const nav = navigationRef.navigate as (name: string, params?: object) => void;
  try {
    if (type === 'CAMP_REMINDER') {
      nav('Camps');
      return;
    }
    // Receiver-facing updates about their own request.
    if (type === 'MATCH_ACCEPTED' || type === 'MATCH_DECLINED' || type === 'REQUEST_FULFILLED' || type === 'REQUEST_EXPIRED') {
      nav('MyRequests');
      return;
    }
    // Donor-facing "a request needs you".
    if (type === 'MATCH_FOUND') {
      if (relatedId) {
        nav('Requests', { screen: 'RequestDetails', params: { requestId: relatedId } });
      } else {
        nav('Requests');
      }
      return;
    }
    // Fallback: the notifications inbox (donor or receiver).
    nav(role === 'RECEIVER' ? 'Notifications' : 'Home');
  } catch {
    // Route not present in the active navigator — ignore.
  }
}
