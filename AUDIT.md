# Mobile App Audit

Read-only investigation. Nothing in this document has been fixed — see each
entry's proposed fix for the recommended next step. Findings are grouped by
severity: **BLOCKER** (crashes, user gets stuck, data loss) → **HIGH**
(feature doesn't work) → **MEDIUM** (works but broken UX) → **LOW** (cosmetic
or hygiene).

Each entry is tagged **[JS]** (pure JS/TS/asset change, hot-reloadable via the
dev-client/Expo Go workflow — see `DEV_WORKFLOW.md`) or **[NATIVE]** (needs a
new native dependency or `app.json`/permission change, requiring
`npx expo run:android` or an EAS rebuild).

**Total: 33 findings — 30 [JS], 3 [NATIVE].** Everything blocking or
high-severity is JS-only except the three date-picker items, which all stem
from the same missing dependency.

---

## BLOCKER

### B1 — Donor request-status navigation fails silently from the "My Requests" tab
**Files:** `apps/mobile/src/navigation/ReceiverNavigator.tsx:69`, `apps/mobile/src/screens/receiver/RequestStatusScreen.tsx:107,130`

`RequestStatusScreen` is used two ways: pushed onto `HomeStack` as the
`RequestStatus` route (works fine, `MatchingDonors` is a sibling route there),
and mounted **directly** as the bottom-tab screen `MyRequests` — with no
`Stack.Navigator` wrapping it. When rendered as the raw tab screen,
`navigation.navigate('MatchingDonors', { requestId })` has no `MatchingDonors`
route to find in the current navigator (the bare `Tab.Navigator`) or any
ancestor, so React Navigation silently drops the action — no crash, no error,
the tap just does nothing. Any receiver who reaches a request via the
**My Requests tab** (rather than the Home tab flow) hits a dead end tapping a
request card. Same bug class as the original registration-blocking issue,
one level deeper in the navigation tree.

**Fix:** Wrap the `MyRequests` tab in its own `createNativeStackNavigator`
(mirroring the pattern already used for every other tab in `DonorNavigator`),
registering `RequestStatus`/`MatchingDonors` inside it.
**[JS]**

---

## HIGH

### H1 — "Donation History" menu item on the donor profile does nothing
**File:** `apps/mobile/src/screens/donor/DonorProfileScreen.tsx:51`

Renders as a fully-styled row (icon, label, chevron) identical to the other
working menu items, but `onPress: () => {}`. A working `DonationHistoryScreen`
exists and is reachable from the bottom History tab, but isn't registered in
the Profile stack, so it can't be trivially wired with a plain `navigate()`.

**Fix:** `navigation.getParent()?.navigate('History')`, or restructure so
`DonationHistory` is reachable from the Profile stack directly.
**[JS]**

### H2 — Date of Birth calendar icon is purely decorative (no date picker exists)
**File:** `apps/mobile/src/screens/auth/DonorProfileSetupScreen.tsx:112-119`

Root cause of the reported "calendar icon does nothing" bug. There is
**no date-picker library in the project at all** — `@react-native-community/datetimepicker`
isn't in `package.json`, confirmed via a full-repo search. `Input.tsx`'s
`rightIcon` prop *is* correctly wired to its own `onPress` internally, but the
call site never passes an `onRightIconPress` handler, so the icon renders as
a real, hit-testable `TouchableOpacity` that visually invites a tap and does
nothing. DOB is currently a hand-typed `DD/MM/YYYY` text field.

**Fix:** Install `@react-native-community/datetimepicker`, wrap it in a
controlled show/hide state toggled by `onRightIconPress`, write the selected
date to `dob` state on `onChange` (guard `event.type === 'dismissed'` on
Android so a cancel doesn't write `undefined`).
**[NATIVE]** (new native dependency — needs `expo run:android` or an EAS
rebuild, not just hot reload)

### H3 — "Required By" calendar icon is the same decorative-only bug, on a required field
**File:** `apps/mobile/src/screens/receiver/CreateRequestScreen.tsx:173-180`

Identical root cause to H2, but on a **required** field expecting both date
and time (`DD/MM/YYYY HH:MM`) — more error-prone to hand-type, and blocks
blood-request creation on a typo.

**Fix:** Same as H2 (shared picker component once installed).
**[NATIVE]**

### H4 — Bad hand-typed DOB reaches the backend uncaught, surfaces as a confusing generic error
**File:** `apps/mobile/src/screens/auth/DonorProfileSetupScreen.tsx:50-56` (`validate()`), `:172-182` (`parseDob`)

`validate()` only checks that DOB is non-empty, never that it's a parseable
date. `parseDob` silently falls back to returning the raw unparsed string
when `new Date(...)` fails, which then hits the backend's date validation and
comes back as a generic `Alert.alert('Setup Failed', <raw backend message>)`
instead of an inline field error — directly compounds H2, since removing the
picker means typos are the *only* way this field gets filled in the meantime.

**Fix:** Validate the parsed date client-side before submit, same pattern
already used correctly in `CreateRequestScreen.tsx`'s `parseRequiredBy`.
**[JS]**

### H5 — Donor dashboard shows a hardcoded "0" for total donations and lives saved, for every donor
**File:** `apps/mobile/src/screens/donor/DonorDashboardScreen.tsx:33`

`const totalDonations = 0;` with a comment `// fetched from donorProfile in
Phase 3 donor profile screen` — feeds directly into the "Total Donated" and
"Lives Saved" stat tiles on the primary dashboard. A donor with real donation
history sees permanent zeroes here, even though the exact same data is
correctly fetched and shown on `DonorProfileScreen` via `donorsApi.getProfile()`.

**Fix:** Fetch/reuse the same `donorsApi.getProfile()` query here.
**[JS]**

---

## MEDIUM

### M1 — Donor verification-pending screen is built but structurally unreachable
**Files:** `apps/mobile/src/navigation/AuthNavigator.tsx:22`, `DonorNavigator.tsx:35,45,61`, `apps/mobile/src/screens/auth/DonorProfileSetupScreen.tsx:86-90`

`VerificationPendingScreen` is registered as a route in 4 different stacks,
but nothing anywhere calls `navigate('VerificationPending'/'VerificationPendingDonor')`.
`DonorProfileSetupScreen` calls `setAuth()` unconditionally after profile
creation regardless of `verifStatus`, sending every new donor straight to the
dashboard. The screen's own copy ("Profile under review... verified within 24
hours") strongly suggests a verification gate was intended but never wired.

**Fix:** Either route unverified donors (`verifStatus !== 'VERIFIED'`) through
this screen after profile setup, or remove the now-pointless route if the
product decision is that unverified donors browse freely.
**[JS]**

### M2 — Donor dashboard avatar looks tappable but has no handler
**File:** `apps/mobile/src/screens/donor/DonorDashboardScreen.tsx:49-51`

Wrapped in a `TouchableOpacity` (implying it should jump to the Profile tab)
with no `onPress`. Inconsistent with `ReceiverDashboardScreen.tsx:46`, where
the equivalent avatar is correctly a plain, non-touchable element.

**Fix:** Wire `onPress` to switch to the Profile tab, or remove the touchable
wrapper.
**[JS]**

### M3 — "Privacy & Safety" and "Help & Support" menu items no-op on both profile screens
**Files:** `apps/mobile/src/screens/donor/DonorProfileScreen.tsx:52-54`, `apps/mobile/src/screens/receiver/ReceiverProfileScreen.tsx:36-37`

Both `onPress: () => {}`, no backing screens exist for either.

**Fix:** Build the screens, or replace with a disabled/"Coming soon" state so
they don't look broken.
**[JS]**

### M4 — Last Donation Date calendar icon is the same decorative-only bug (optional field)
**File:** `apps/mobile/src/screens/auth/DonorProfileSetupScreen.tsx:130-136`

Same root cause as H2, lower severity since the field is optional.
**[NATIVE]**

### M5 — Donor profile setup screen has no `KeyboardAvoidingView`
**File:** `apps/mobile/src/screens/auth/DonorProfileSetupScreen.tsx`

Every other form screen (`RegistrationScreen`, `LoginScreen`, `OTPScreen`,
`CreateRequestScreen`) wraps its content in `KeyboardAvoidingView`; this one
only has a bare `ScrollView`. On iOS the keyboard can cover lower fields and
the Save button — more likely to actually bite here specifically because
users must hand-type the DOB field (no picker, see H2).

**Fix:** Wrap in `KeyboardAvoidingView behavior={Platform.OS === 'ios' ?
'padding' : undefined}`, matching sibling screens.
**[JS]**

### M6 — City/hospital search picker leaks a debounce timer on unmount
**File:** `apps/mobile/src/components/SearchPicker.tsx:36,41,53`

`debounceRef`'s `setTimeout` is never cleared on unmount. If a user types into
the search box then closes the modal or navigates away before the 400ms
debounce fires, the pending callback still runs later and calls `setState` on
an unmounted component (React warning + wasted network call). Affects both
the registration City search and the request-creation Hospital search — i.e.
every registration and every blood request flows through this component.

**Fix:** Add an unmount-cleanup `useEffect` that clears `debounceRef.current`.
**[JS]**

### M7 — Real-time notifications never reach the UI despite being advertised
**File:** `apps/mobile/src/services/websocket.ts:55-60`

`addNotificationListener` is defined and the socket does connect and listen
for `'notification'` server events, but nothing in the app ever calls
`addNotificationListener` — confirmed via full-repo search, only `connect`/
`disconnect` are used. `RequestSubmittedScreen` explicitly promises "Real-time
Alerts" to users, but every push is silently discarded; `NotificationsScreen`
only ever updates via manual pull-to-refresh. A likely real contributor to
the "general UI glitchiness" complaint.

**Fix:** Call `wsService.addNotificationListener(...)` somewhere (e.g. in
`AppInit` or `NotificationsScreen`) to invalidate the notifications query
cache or surface a toast on incoming events.
**[JS]**

### M8 — Donor dashboard's nearby-requests query has no loading or error state
**File:** `apps/mobile/src/screens/donor/DonorDashboardScreen.tsx:26-30`

`requests` defaults to `[]` with no `isLoading`/`error` handling in the
render — a failed fetch looks identical to "no nearby requests," with no
retry affordance. Contrast with `NearbyRequestsScreen.tsx`, which has both.
**[JS]**

### M9 — Receiver dashboard has a loading state but no error state
**File:** `apps/mobile/src/screens/receiver/ReceiverDashboardScreen.tsx:84-87`

Spinner shown correctly while loading, but a failed query renders identically
to "0 active requests" — no way to tell the difference.
**[JS]**

### M10 — Receiver "Notifications" tab is also a raw, unwrapped tab screen
**File:** `apps/mobile/src/navigation/ReceiverNavigator.tsx:70`

Same structural pattern as B1 (no `Stack.Navigator` wrapper). Doesn't crash
since `NotificationsScreen` only calls `goBack()`, but that falls back to
switching tabs (via `backBehavior: 'history'`) rather than a true pop — an
inconsistent feel versus every other back-arrow in the app.

**Fix:** Wrap in a stack for consistency (same fix shape as B1).
**[JS]**

---

## LOW

### L1 — "Terms & Privacy Policy" link has no `onPress`
`apps/mobile/src/screens/auth/LoginScreen.tsx:98-100` **[JS]**

### L2 — Request-submitted screen has no header/back button
`apps/mobile/src/screens/receiver/RequestSubmittedScreen.tsx` — not a true
dead end (two working outbound buttons exist, hardware back still works via
default stack-pop), just no visible way to leave other than the two primary
actions. **[JS]**

### L3 — `DonorProfileEdit` route type declared, no screen ever built
`apps/mobile/src/navigation/types.ts:26` — inert today (nothing references
it), but a landmine: any future "Edit Profile" button wired to this route
name will crash at runtime since no screen is registered for it. **[JS]**

### L4 — `RequestDetailsScreen.handleCall` is fully implemented but never invoked
`apps/mobile/src/screens/donor/RequestDetailsScreen.tsx:99-103` — dead code;
the analogous, correctly-wired version exists in `MatchingDonorsScreen.tsx`.
Suggests a "Call" button was planned here but never added. **[JS]**

### L5 — Registration screen has an 800ms fake delay before navigating
`apps/mobile/src/screens/auth/RegistrationScreen.tsx:38` — no real API call
happens here (that's one screen later, in `RoleSelectionScreen`); the spinner
is pure cosmetic theater. **[JS]**

### L6 — OTP resend errors shown via `Alert`, not inline
`apps/mobile/src/screens/auth/OTPScreen.tsx:98-113` — inconsistent with the
inline-error pattern used for verify failures on the same screen. **[JS]**

### L7 — Report-user screen: reason validation via `Alert`, no `KeyboardAvoidingView`
`apps/mobile/src/screens/common/ReportUserScreen.tsx:29-32` — inconsistent
error-display pattern; missing keyboard-avoidance around the multiline
textarea (same class of gap as M5). **[JS]**

### L8 — Push-notification/WebSocket init errors are silently swallowed
`apps/mobile/src/services/push-notifications.ts:36-42`, `App.tsx:43-55` — the
whole init IIFE ends in `.catch(() => {})` with zero logging. Not a crash
risk, but zero visibility if token registration or the socket connection
fails. **[JS]**

### L9 — Receiver profile stats query has no loading/error state
`apps/mobile/src/screens/receiver/ReceiverProfileScreen.tsx:19-22` — same
shape as M8/M9, lower traffic screen. **[JS]**

### L10 — OTP countdown recreates its interval every tick
`apps/mobile/src/screens/auth/OTPScreen.tsx:32` — functionally correct
(cleanup is present), just wasteful: a new `setInterval` is created on every
single countdown tick instead of one persistent interval. **[JS]**

### L11 — Splash screen's `Animated.Value`s aren't wrapped in `useRef`
`apps/mobile/src/screens/auth/SplashScreen.tsx:11-12` — inconsistent with the
correct pattern in `RequestSubmittedScreen.tsx`. If the component re-renders
before the 2.5s timer fires, animation state resets. Low risk given the
screen's transient nature. **[JS]**

### L12 — Receivers have no way to cancel a request from the app
Backend has `PATCH /requests/:id/cancel` (`apps/backend/src/modules/requests/requests.controller.ts:45`)
and `PATCH /donors/availability` (`donors.controller.ts:25`) with no mobile
caller for either — the cancel-request one is a real missing UX affordance,
not just unused code. **[JS]** (mobile-side addition)

### L13-L16 — Dead code left over from an earlier prototype phase
- `apps/mobile/src/context/AppContext.tsx` / `AppProvider` — fully unused
  parallel state system, still wraps the whole app in `App.tsx` for no effect
  (real auth state is the zustand `auth.store.ts`).
- `apps/mobile/src/mockData/*.ts` — unused mock data, confirmed unimported.
- `apps/mobile/src/types/index.ts` — most interfaces (`User`, `Donor`,
  `BloodRequest`, `Notification`, `DonationRecord`) are unused; only
  `BloodGroup`/`UrgencyLevel`/`Gender` are still live.
- `apps/mobile/src/utils/helpers.ts` — `generateRequestId`, `validatePhone`,
  `validateName` have no call sites; validation is done inline per-screen
  instead.

No functional impact — flagged purely so a future maintainer doesn't waste
time figuring out whether these matter. **[JS]** each.

### L17 — `CreateRequestScreen`'s `hospitalAddress` payload field is never populated
`apps/mobile/src/api/requests.api.ts` (`CreateRequestPayload.hospitalAddress`)
— defined as optional, no UI control in `CreateRequestScreen` ever sets it.
Not a bug (optional field, backend handles its absence fine), just dead
surface area. **[JS]**

---

## Confirmed healthy (checked, no issues found)

- **OTP flow** — screen, zustand store, mobile API, backend service, and
  Prisma schema are all fully wired and consistent. The fixed-test-code
  simplification (`SMS_PROVIDER=console` → always `123456`) is intentional
  and explicitly commented in `auth.service.ts`; it doesn't leave any dead or
  inconsistent code behind.
- **Every live `navigate()` call** (22 call sites) targets a route that
  actually exists in its navigator with all required params supplied —
  verified against `navigation/types.ts`.
- **No unguarded data access** — every screen consuming `useQuery` either
  defaults the data to an empty value or guards on `isLoading`/`error` before
  rendering; no crash-risk `data.map(...)` on possibly-undefined data found
  anywhere.
- **No unhandled promise rejections** — every async call site outside the
  api layer itself is wrapped in try/catch with user feedback, or routed
  through React Query.
- **`RootNavigator`'s navigator nesting** is correct — one
  `NavigationContainer`, clean conditional switching between Auth/Donor/
  Receiver navigators, no double-nesting.
- **Payload wiring** on every audited form (Login, OTP, Registration,
  RoleSelection, DonorProfileSetup, CreateRequest, ReportUser) — every
  captured field reaches its API call, no silently-dropped or phantom
  fields, except the two explicitly-noted dead optional fields (L17).
