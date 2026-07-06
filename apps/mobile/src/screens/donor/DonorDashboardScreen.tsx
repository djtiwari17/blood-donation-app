import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DonorHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { BloodGroupBadge, UrgencyBadge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { requestsApi, ApiBloodRequest } from '../../api/requests.api';

type Props = { navigation: NativeStackNavigationProp<DonorHomeStackParamList, 'DonorDashboard'> };

const URGENCY_DISPLAY: Record<string, string> = {
  CRITICAL: 'Urgent', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low',
};

export const DonorDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const { data: requests = [] } = useQuery<ApiBloodRequest[]>({
    queryKey: ['nearbyRequests'],
    queryFn: () => requestsApi.getNearbyRequests(50),
    retry: 1,
  });

  const firstName = user?.name?.split(' ')[0] ?? 'Donor';
  const totalDonations = 0; // fetched from donorProfile in Phase 3 donor profile screen

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
        <TouchableOpacity>
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
              <Text style={styles.dropNum}>{user?.bloodGroup ?? '?'}</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total Donated', value: totalDonations, icon: 'heart', color: colors.primary },
            { label: 'Lives Saved', value: totalDonations * 3, icon: 'people', color: colors.success },
            { label: 'Requests Near', value: requests.length, icon: 'location', color: colors.secondary },
          ].map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Ionicons name={s.icon as any} size={22} color={s.color} />
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Nearby Requests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Requests</Text>
            <TouchableOpacity onPress={() => navigation.navigate('NearbyRequests')}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>
          {requests.slice(0, 5).map((r) => (
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
                <UrgencyBadge level={(URGENCY_DISPLAY[r.urgency] ?? r.urgency) as any} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
});
