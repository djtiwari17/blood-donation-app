// Set EXPO_PUBLIC_API_URL in apps/mobile/.env.local for development
// e.g. EXPO_PUBLIC_API_URL=http://192.168.1.x:3000 (use LAN IP, not localhost, for device/emulator)
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000') + '/v1';
