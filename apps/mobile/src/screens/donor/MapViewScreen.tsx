import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { DonorHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Header } from '../../components/Header';
import { UrgencyBadge } from '../../components/Badge';
import { requestsApi, ApiBloodRequest } from '../../api/requests.api';
import { getDeviceCoords, Coords } from '../../utils/location';
import { openInGoogleMaps } from '../../utils/maps';
import { formatBloodGroup } from '../../utils/format';

const EMERGENCY_URGENCY = new Set(['CRITICAL', 'HIGH']);
const INDIA_CENTER = { lat: 22.9734, lng: 78.6569 };

type Pin = {
  id: string;
  lat: number;
  lng: number;
  emergency: boolean;
  patientName: string;
};

export const MapViewScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<DonorHomeStackParamList>>();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locState, setLocState] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['nearbyRequests'],
    queryFn: () => requestsApi.getNearbyRequests(50),
    retry: 1,
  });

  // One-shot location fetch on mount (no continuous GPS watching → battery-safe).
  useEffect(() => {
    let active = true;
    (async () => {
      const c = await getDeviceCoords();
      if (!active) return;
      setCoords(c);
      setLocState(c ? 'ready' : 'denied');
    })();
    return () => { active = false; };
  }, []);

  const pins: Pin[] = useMemo(
    () =>
      requests
        .filter(r => r.hospitalLat != null && r.hospitalLng != null)
        .map(r => ({
          id: r.id,
          lat: r.hospitalLat as number,
          lng: r.hospitalLng as number,
          emergency: EMERGENCY_URGENCY.has(r.urgency),
          patientName: r.patientName,
        })),
    [requests],
  );

  const html = useMemo(() => buildMapHtml(pins, coords), [pins, coords]);
  const selected = requests.find(r => r.id === selectedId) ?? null;

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'pin' && msg.id) setSelectedId(msg.id);
      if (msg.type === 'map') setSelectedId(null);
    } catch { /* ignore malformed messages */ }
  };

  const callRequester = (phone?: string | null) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Unable to call', 'Could not open the dialer on this device.'),
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Map View" onBack={() => navigation.goBack()} />

      {locState === 'denied' && (
        <View style={styles.banner}>
          <Ionicons name="location-outline" size={16} color={colors.warning} />
          <Text style={styles.bannerText}>
            Location unavailable — showing requests without your position.
          </Text>
        </View>
      )}

      <View style={styles.mapWrap}>
        {isLoading && locState === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : pins.length === 0 ? (
          <View style={styles.loading}>
            <Ionicons name="map-outline" size={48} color={colors.grayLight} />
            <Text style={styles.emptyText}>No mappable requests nearby</Text>
          </View>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            onMessage={onMessage}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
          />
        )}
      </View>

      {/* Bottom summary card for the tapped pin */}
      {selected && (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHead}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('RequestDetails', { requestId: selected.id })}
          >
            <View style={styles.bgBadge}>
              <Text style={styles.bgText}>{formatBloodGroup(selected.bloodGroup)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patient} numberOfLines={1}>{selected.patientName}</Text>
              <Text style={styles.hospital} numberOfLines={1}>{selected.hospitalName}</Text>
              <Text style={styles.dist}>
                {selected.distanceKm != null ? `${selected.distanceKm.toFixed(1)} km away` : ''}
              </Text>
            </View>
            <UrgencyBadge level={selected.urgency} />
          </TouchableOpacity>

          <View style={styles.cardActions}>
            {selected.myMatch?.status === 'ACCEPTED' ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.callBtn]}
                onPress={() => callRequester(selected.receiverPhone)}
              >
                <Ionicons name="call" size={16} color={colors.white} />
                <Text style={styles.callText}>Call</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.detailsBtn]}
                onPress={() => navigation.navigate('RequestDetails', { requestId: selected.id })}
              >
                <Text style={styles.detailsText}>View Details</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.dirBtn]}
              onPress={() => openInGoogleMaps(selected.hospitalLat, selected.hospitalLng, selected.hospitalName)}
            >
              <Ionicons name="navigate" size={16} color={colors.primary} />
              <Text style={styles.dirText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ── Self-contained Leaflet map (OSM tiles) ─────────────────────────────────────

function buildMapHtml(pins: Pin[], user: Coords | null): string {
  const center = user ?? (pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : INDIA_CENTER);
  const zoom = user || pins.length ? 12 : 5;
  const pinsJson = JSON.stringify(pins);
  const userJson = JSON.stringify(user);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .req-dot {
      width: 22px; height: 22px; border-radius: 50%;
      border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    }
    .user-dot {
      width: 16px; height: 16px; border-radius: 50%;
      background: #1565C0; border: 3px solid #fff; box-shadow: 0 0 0 4px rgba(21,101,192,0.25);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var post = function (obj) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    };
    var map = L.map('map', { zoomControl: true, attributionControl: true })
      .setView([${center.lat}, ${center.lng}], ${zoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', function () { post({ type: 'map' }); });

    var pins = ${pinsJson};
    var user = ${userJson};
    var group = [];

    pins.forEach(function (p) {
      var color = p.emergency ? '#E53935' : '#1565C0';
      var icon = L.divIcon({
        className: '',
        html: '<div class="req-dot" style="background:' + color + '"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      var m = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
      m.on('click', function () { post({ type: 'pin', id: p.id }); });
      group.push([p.lat, p.lng]);
    });

    if (user) {
      var uicon = L.divIcon({
        className: '',
        html: '<div class="user-dot"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([user.lat, user.lng], { icon: uicon }).addTo(map);
      group.push([user.lat, user.lng]);
    }

    if (group.length > 1) {
      map.fitBounds(group, { padding: [40, 40], maxZoom: 14 });
    }
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.warningLight, paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
  },
  bannerText: { flex: 1, fontSize: fonts.sizes.sm, color: colors.textSecondary },
  mapWrap: { flex: 1, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: colors.grayPale },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { fontSize: fonts.sizes.base, color: colors.textHint },
  card: {
    position: 'absolute', left: spacing.base, right: spacing.base, bottom: spacing.base,
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.base, ...shadow.lg,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bgBadge: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryPale,
    alignItems: 'center', justifyContent: 'center',
  },
  bgText: { fontSize: fonts.sizes.md, fontWeight: '800', color: colors.primary },
  patient: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.textPrimary },
  hospital: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  dist: { fontSize: fonts.sizes.xs, color: colors.textHint, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md,
  },
  callBtn: { backgroundColor: colors.success },
  callText: { color: colors.white, fontWeight: '700', fontSize: fonts.sizes.sm },
  detailsBtn: { backgroundColor: colors.primary },
  detailsText: { color: colors.white, fontWeight: '700', fontSize: fonts.sizes.sm },
  dirBtn: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
  dirText: { color: colors.primary, fontWeight: '700', fontSize: fonts.sizes.sm },
});
