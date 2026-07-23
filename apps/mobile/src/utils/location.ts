import * as Location from 'expo-location';
import { donorsApi } from '../api/donors.api';

export type Coords = { lat: number; lng: number };

const FIX_TIMEOUT_MS = 10_000;

// Get the device position without ever hanging: on devices/emulators with no
// GPS fix available, getCurrentPositionAsync can stay pending forever. Race it
// against a timeout, fall back to the last known position, and finally return
// null — every caller treats coordinates as optional.
export async function getDeviceCoords(): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const current = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ]);
    if (current) {
      return { lat: current.coords.latitude, lng: current.coords.longitude };
    }

    const last = await Location.getLastKnownPositionAsync();
    return last ? { lat: last.coords.latitude, lng: last.coords.longitude } : null;
  } catch {
    return null;
  }
}

// The nearby feed / map require a saved donor location; the backend returns a
// 400 mentioning "location" when it's missing. Detect that so the UI can show a
// helpful "enable location" action instead of a generic error.
export function isLocationNotSetError(err: any): boolean {
  if (err?.response?.status !== 400) return false;
  const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? '';
  return /location/i.test(String(msg));
}

// Capture the device's current position and save it to the donor profile so
// location-based features start working. Returns true on success.
export async function enableDonorLocation(): Promise<boolean> {
  const coords = await getDeviceCoords();
  if (!coords) return false;
  try {
    await donorsApi.updateLocation(coords.lat, coords.lng);
    return true;
  } catch {
    return false;
  }
}
