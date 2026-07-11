import * as Location from 'expo-location';

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
