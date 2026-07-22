import { Linking, Alert } from 'react-native';

/**
 * Open a location in the device's Google Maps app (falls back to the browser
 * if the app isn't installed). Independent of the in-app map renderer — this is
 * just a deep link, so it works alongside the OSM/Leaflet map.
 */
export async function openInGoogleMaps(lat?: number | null, lng?: number | null, label?: string) {
  if (lat == null || lng == null) {
    Alert.alert('No location', 'This request has no map location available.');
    return;
  }
  const query = label ? `${lat},${lng}(${encodeURIComponent(label)})` : `${lat},${lng}`;
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const geo = `geo:${lat},${lng}?q=${query}`;
  try {
    // Prefer the native geo: intent (opens the maps app chooser); fall back to
    // the universal https URL which always resolves to Google Maps or a browser.
    const canGeo = await Linking.canOpenURL(geo);
    await Linking.openURL(canGeo ? geo : url);
  } catch {
    Linking.openURL(url).catch(() =>
      Alert.alert('Unable to open maps', 'Could not open a maps app on this device.'),
    );
  }
}
