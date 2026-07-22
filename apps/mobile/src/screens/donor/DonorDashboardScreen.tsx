import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DonorHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { BloodGroupBadge, UrgencyBadge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { CampsPreview } from '../../components/CampsPreview';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { requestsApi, ApiBloodRequest } from '../../api/requests.api';
import { donorsApi } from '../../api/donors.api';
import { formatBloodGroup } from '../../utils/format';

// Urgency tiers treated as "emergency" for the highlighted home section.
const EMERGENCY_URGENCY = new Set(['CRITICAL', 'HIGH']);

type Props = { navigation: NativeStackNavigationProp<DonorHomeStackParamList, 'DonorDashboard'> };

export const DonorDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const {
    data: requests = [],
    isLoading: requestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useQuery<ApiBloodRequest[]>({
    queryKey: ['nearbyRequests'],
    queryFn: () => requestsApi.getNearbyRequests(50),
    retry: 1,
  });

  const { data: profile } = useQuery({
    queryKey: ['donorProfile'],
    queryFn: donorsApi.getProfile,
  });

  const firstName = user?.name?.split(' ')[0] ?? 'Donor';
  const totalDonations = profile?.totalDonations ?? 0;
  const livesSaved = profile?.livesSaved ?? totalDonations * 3;

  const emergencies = requests.filter((r) => EMERGENCY_URGENCY.has(r.urgency));

  // "Request Blood" is a receiver action. DONOR_RECEIVER users can post one via
  // the nested request flow; pure donors can't (backend blocks it), so explain.
  const handleRequestBlood = () => {
    if (user?.role === 'DONOR_RECEIVER') {
      navigation.navigate('RequestFlow', { screen: 'CreateRequest' });
    } else {
      Alert.alert(
        'Requesting blood',
        "You're registered as a donor. Posting a blood request needs receiver access on your account.",
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hi, {firstName} 👋</Text>
          <Text style={styles.subGreeting}>Be a hero, donate blood</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
          <View style={styles.bellWrap}>
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            <View style={styles.badge} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.getParent()?.navigate('Profile')}>
          <Avatar name={user?.name ?? 'U'} size={40} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroLabel}>You can save up to</Text>
            <Text style={styles.heroCount}>3 Lives</Text>
            <Text style={styles.heroSub}>Be a blood hero today!</Text>
          </View>
          <View style={styles.heroRight}>
            <View style={styles.dropIcon}>
              <Text style={styles.dropNum}>{formatBloodGroup(user?.bloodGroup) || '?'}</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total Donated', value: totalDonations, icon: 'heart', color: colors.primary },
            { label: 'Lives Saved', value: livesSaved, icon: 'people', color: colors.success },
            { label: 'Requests Near', value: requests.length, icon: 'location', color: colors.secondary },
          ].map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Ionicons name={s.icon as any} size={22} color={s.color} />
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickPrimary]}
            onPress={() => navigation.navigate('NearbyRequests')}
            activeOpacity={0.85}
          >
            <Ionicons name="water" size={20} color={colors.white} />
            <Text style={styles.quickPrimaryText}>Donate Blood</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickOutline]}
            onPress={handleRequestBlood}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.quickOutlineText}>Request Blood</Text>
          </TouchableOpacity>
        </View>

        {/* Emergency Requests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Requests</Text>
            <TouchableOpacity onPress={() => navigation.navigate('NearbyRequests')}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>
          {requestsError ? (
            <View style={styles.sectionState}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
              <Text style={styles.sectionStateText}>Failed to load requests</Text>
              <TouchableOpacity onPress={() => refetchRequests()}>
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : requestsLoading ? (
            <View style={styles.sectionState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : emergencies.length === 0 ? (
            <View style={styles.sectionState}>
              <Ionicons name="checkmark-circle-outline" size={32} color={colors.grayLight} />
              <Text style={styles.sectionStateText}>No emergency requests nearby</Text>
            </View>
          ) : (
            emergencies.slice(0, 2).map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.requestCard, styles.emergencyCard]}
                onPress={() => navigation.navigate('RequestDetails', { requestId: r.id })}
                activeOpacity={0.8}
              >
                <BloodGroupBadge group={r.bloodGroup as any} size="md" />
                <View style={styles.reqInfo}>
                  <Text style={styles.reqUnits}>{r.patientName}</Text>
                  <Text style={styles.reqHospital}>{r.hospitalName}</Text>
                  <Text style={styles.reqDist}>
                    {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km away` : ''}
                  </Text>
                </View>
                <View style={styles.reqRight}>
                  <UrgencyBadge level={r.urgency} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Nearby Requests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Requests</Text>
            <TouchableOpacity onPress={() => navigation.navigate('NearbyRequests')}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>
          {requestsError ? (
            <View style={styles.sectionState}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
              <Text style={styles.sectionStateText}>Failed to load nearby requests</Text>
              <TouchableOpacity onPress={() => refetchRequests()}>
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : requestsLoading ? (
            <View style={styles.sectionState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : requests.length === 0 ? (
            <View style={styles.sectionState}>
              <Ionicons name="search-outline" size={32} color={colors.grayLight} />
              <Text style={styles.sectionStateText}>No requests nearby</Text>
            </View>
          ) : (
          requests.slice(0, 5).map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.requestCard}
              onPress={() => navigation.navigate('RequestDetails', { requestId: r.id })}
              activeOpacity={0.8}
            >
              <BloodGroupBadge group={r.bloodGroup as any} size="md" />
              <View style={styles.reqInfo}>
                <Text style={styles.reqUnits}>{r.unitsNeeded} Units</Text>
                <Text style={styles.reqHospital}>{r.hospitalName}</Text>
                <Text style={styles.reqDist}>
                  {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km away` : ''}
                </Text>
              </View>
              <View style={styles.reqRight}>
                <UrgencyBadge level={r.urgency} />
              </View>
            </TouchableOpacity>
          ))
          )}
        </View>

        {/* Blood Camps & Events */}
        <CampsPreview onViewAll={() => navigation.getParent()?.navigate('Camps')} />

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, paddingHorizontal: spacing.base,
    paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  greeting: { fontSize: fonts.sizes.lg, fontWeight: '800', color: colors.textPrimary },
  subGreeting: { fontSize: fonts.sizes.sm, color: colors.textSecondary },
  bellWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary,
  },
  heroCard: {
    margin: spacing.base, padding: spacing.lg, borderRadius: radius.xl,
    backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', ...shadow.md,
  },
  heroLeft: { flex: 1 },
  heroLabel: { fontSize: fonts.sizes.sm, color: 'rgba(255,255,255,0.8)' },
  heroCount: { fontSize: fonts.sizes.xxxl, fontWeight: '900', color: colors.white },
  heroSub: { fontSize: fonts.sizes.sm, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  heroRight: { alignItems: 'center', justifyContent: 'center' },
  dropIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  dropNum: { fontSize: fonts.sizes.lg, fontWeight: '800', color: colors.white },
  statsRow: {
    flexDirection: 'row', marginHorizontal: spacing.base, gap: spacing.sm, marginBottom: spacing.sm,
  },
  statBox: {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center', gap: 4, ...shadow.sm,
  },
  statVal: { fontSize: fonts.sizes.xl, fontWeight: '800' },
  statLabel: { fontSize: fonts.sizes.xs, color: colors.textSecondary, textAlign: 'center' },
  quickRow: {
    flexDirection: 'row', marginHorizontal: spacing.base, gap: spacing.sm, marginTop: spacing.sm,
  },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.lg, ...shadow.sm,
  },
  quickPrimary: { backgroundColor: colors.primary },
  quickPrimaryText: { color: colors.white, fontWeight: '700', fontSize: fonts.sizes.md },
  quickOutline: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
  quickOutlineText: { color: colors.primary, fontWeight: '700', fontSize: fonts.sizes.md },
  emergencyCard: { backgroundColor: colors.urgentBg, borderWidth: 1, borderColor: colors.primaryPale },
  section: { margin: spacing.base, marginTop: spacing.sm },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.textPrimary },
  viewAll: { fontSize: fonts.sizes.sm, color: colors.primary, fontWeight: '600' },
  requestCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.sm, ...shadow.sm,
  },
  reqInfo: { flex: 1 },
  reqUnits: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.textPrimary },
  reqHospital: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  reqDist: { fontSize: fonts.sizes.xs, color: colors.textHint, marginTop: 2 },
  reqRight: { alignItems: 'flex-end', gap: 4 },
  reqTime: { fontSize: fonts.sizes.xs, color: colors.textHint },
  sectionState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  sectionStateText: { fontSize: fonts.sizes.sm, color: colors.textHint },
  retryText: { fontSize: fonts.sizes.sm, color: colors.primary, fontWeight: '600' },
});
