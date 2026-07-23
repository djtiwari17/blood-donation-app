import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput, Alert, Linking, ScrollView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { DonorHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Header } from '../../components/Header';
import { BloodGroupBadge, UrgencyBadge } from '../../components/Badge';
import { requestsApi, ApiBloodRequest } from '../../api/requests.api';
import { formatBloodGroup } from '../../utils/format';
import { isLocationNotSetError, enableDonorLocation } from '../../utils/location';

const FILTERS = ['All', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
type Filter = typeof FILTERS[number];

// Urgency tiers rendered as "emergency" (red-tinted, sorted to top server-side).
const EMERGENCY_URGENCY = new Set(['CRITICAL', 'HIGH']);

export const NearbyRequestsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<DonorHomeStackParamList>>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [enabling, setEnabling] = useState(false);

  const handleEnableLocation = async () => {
    setEnabling(true);
    const ok = await enableDonorLocation();
    setEnabling(false);
    if (ok) refetch();
    else Alert.alert('Location needed', 'Allow location access so we can show requests near you.');
  };

  const { data: requests = [], isLoading, error, refetch } = useQuery({
    queryKey: ['nearbyRequests'],
    queryFn: () => requestsApi.getNearbyRequests(50),
    retry: 1,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => requestsApi.acceptRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nearbyRequests'] });
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
      Alert.alert('Accepted', 'You accepted this request. You can now call the requester to coordinate the donation.');
    },
    onError: (err: any) => {
      Alert.alert('Could not accept', err?.response?.data?.message ?? 'Please try again.');
    },
  });

  const confirmAccept = (item: ApiBloodRequest) => {
    Alert.alert(
      'Accept request',
      `Confirm you can donate ${formatBloodGroup(item.bloodGroup)} blood for ${item.patientName} at ${item.hospitalName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, I can donate', onPress: () => acceptMutation.mutate(item.id) },
      ],
    );
  };

  const callRequester = (phone?: string | null) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Unable to call', 'Could not open the dialer on this device.'),
    );
  };

  const filtered = requests
    .filter(r => filter === 'All' || formatBloodGroup(r.bloodGroup) === filter)
    .filter(r =>
      !search ||
      formatBloodGroup(r.bloodGroup).toLowerCase().includes(search.toLowerCase()) ||
      r.hospitalName.toLowerCase().includes(search.toLowerCase()) ||
      r.patientName.toLowerCase().includes(search.toLowerCase())
    );

  const renderItem = ({ item }: { item: ApiBloodRequest }) => {
    const isEmergency = EMERGENCY_URGENCY.has(item.urgency);
    const accepted = item.myMatch?.status === 'ACCEPTED';
    const donated = item.myMatch?.status === 'DONATED';
    const busy = acceptMutation.isPending && acceptMutation.variables === item.id;

    return (
      <View style={[styles.card, isEmergency && styles.emergencyCard]}>
        <TouchableOpacity
          style={styles.cardTop}
          onPress={() => navigation.navigate('RequestDetails', { requestId: item.id })}
          activeOpacity={0.8}
        >
          <BloodGroupBadge group={item.bloodGroup as any} size="md" />
          <View style={styles.info}>
            <View style={styles.topRow}>
              <View style={styles.patientWrap}>
                <Text style={styles.patient} numberOfLines={1}>{item.patientName}</Text>
                {item.isVerified ? (
                  <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                ) : null}
              </View>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </View>
            <Text style={styles.hospital} numberOfLines={1}>{item.hospitalName}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={colors.textHint} />
              <Text style={styles.meta}>
                {item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km` : 'Distance unknown'}
              </Text>
              <Text style={styles.metaDot}>•</Text>
              <Ionicons name="water-outline" size={12} color={colors.textHint} />
              <Text style={styles.meta}>{item.unitsNeeded} units</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="alarm-outline" size={12} color={colors.error} />
              <Text style={styles.metaUrgent}>By {formatShort(item.requiredBy)}</Text>
            </View>
          </View>
          <View style={styles.right}>
            <UrgencyBadge level={item.urgency} />
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          {donated ? (
            <View style={styles.doneTag}>
              <Ionicons name="heart" size={14} color={colors.primary} />
              <Text style={styles.doneText}>Donated</Text>
            </View>
          ) : accepted ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.callBtn]}
              onPress={() => callRequester(item.receiverPhone)}
            >
              <Ionicons name="call" size={16} color={colors.white} />
              <Text style={styles.callText}>Call Requester</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn, busy && styles.btnDisabled]}
              onPress={() => confirmAccept(item)}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color={colors.white} />
                  <Text style={styles.acceptText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.detailsBtn]}
            onPress={() => navigation.navigate('RequestDetails', { requestId: item.id })}
          >
            <Text style={styles.detailsText}>Details</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (error) {
    const locNeeded = isLocationNotSetError(error);
    return (
      <View style={styles.container}>
        <Header title="Nearby Requests" onBack={() => navigation.goBack()} />
        <View style={styles.empty}>
          <Ionicons
            name={locNeeded ? 'location-outline' : 'alert-circle-outline'}
            size={48}
            color={locNeeded ? colors.secondary : colors.error}
          />
          <Text style={styles.emptyText}>
            {locNeeded ? 'Turn on location to see requests near you' : 'Failed to load requests'}
          </Text>
          {locNeeded ? (
            <TouchableOpacity onPress={handleEnableLocation} style={styles.enableBtn} disabled={enabling}>
              {enabling ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="navigate" size={16} color={colors.white} />
                  <Text style={styles.enableText}>Enable Location</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Nearby Requests" onBack={() => navigation.goBack()} />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by patient, blood group or hospital"
          placeholderTextColor={colors.textHint}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.gray} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        refreshing={isLoading}
        onRefresh={refetch}
        contentContainerStyle={[styles.list, { paddingBottom: 88 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={48} color={colors.grayLight} />
            <Text style={styles.emptyText}>
              {isLoading ? 'Loading...' : 'No requests nearby'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.mapToggle}
        onPress={() => navigation.navigate('MapView')}
        activeOpacity={0.85}
      >
        <Ionicons name="map" size={18} color={colors.white} />
        <Text style={styles.mapToggleText}>Map View</Text>
      </TouchableOpacity>
    </View>
  );
};

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    margin: spacing.base, marginBottom: spacing.sm, backgroundColor: colors.white,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 46,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: fonts.sizes.base, color: colors.textPrimary },
  filterScroll: { maxHeight: 44, marginBottom: spacing.xs },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.base, gap: spacing.sm, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6, height: 32, justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.white,
    borderWidth: 1.5, borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: fonts.sizes.sm, color: colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: colors.white },
  list: { padding: spacing.base, paddingTop: spacing.xs },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.sm, ...shadow.sm,
  },
  emergencyCard: { backgroundColor: colors.urgentBg, borderWidth: 1, borderColor: colors.primaryPale },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patientWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  patient: { flexShrink: 1, fontSize: fonts.sizes.md, fontWeight: '700', color: colors.textPrimary },
  time: { fontSize: fonts.sizes.xs, color: colors.textHint, marginLeft: spacing.sm },
  hospital: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  meta: { fontSize: fonts.sizes.xs, color: colors.textHint },
  metaDot: { fontSize: fonts.sizes.xs, color: colors.grayLight, marginHorizontal: 2 },
  metaUrgent: { fontSize: fonts.sizes.xs, color: colors.error, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 2 },
  actions: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md,
  },
  acceptBtn: { backgroundColor: colors.primary },
  acceptText: { color: colors.white, fontWeight: '700', fontSize: fonts.sizes.sm },
  callBtn: { backgroundColor: colors.success },
  callText: { color: colors.white, fontWeight: '700', fontSize: fonts.sizes.sm },
  detailsBtn: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
  detailsText: { color: colors.primary, fontWeight: '700', fontSize: fonts.sizes.sm },
  btnDisabled: { opacity: 0.6 },
  doneTag: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primaryPale,
  },
  doneText: { color: colors.primary, fontWeight: '700', fontSize: fonts.sizes.sm },
  mapToggle: {
    position: 'absolute', alignSelf: 'center', bottom: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.full, ...shadow.lg,
  },
  mapToggleText: { color: colors.white, fontWeight: '700', fontSize: fonts.sizes.md },
  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.md },
  emptyText: { fontSize: fonts.sizes.base, color: colors.textHint },
  retryBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.base },
  retryText: { color: colors.primary, fontWeight: '600' },
  enableBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderRadius: radius.md, marginTop: spacing.xs,
  },
  enableText: { color: colors.white, fontWeight: '700', fontSize: fonts.sizes.md },
});
