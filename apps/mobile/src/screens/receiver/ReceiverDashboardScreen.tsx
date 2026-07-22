import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { ReceiverHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { BloodGroupBadge, UrgencyBadge } from '../../components/Badge';
import { CampsPreview } from '../../components/CampsPreview';
import { useAuthStore } from '../../store/auth.store';
import { requestsApi, ApiBloodRequest } from '../../api/requests.api';

type Props = { navigation: NativeStackNavigationProp<ReceiverHomeStackParamList, 'ReceiverDashboard'> };

const ACTIVE_STATUSES = new Set(['PENDING', 'PARTIALLY_FULFILLED']);

export const ReceiverDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const firstName = user?.name?.split(' ')[0] ?? 'User';

  const { data: allRequests = [], isLoading, error, refetch } = useQuery({
    queryKey: ['myRequests'],
    queryFn: requestsApi.getMyRequests,
  });

  const activeRequests = allRequests.filter(r => ACTIVE_STATUSES.has(r.status));

  // Pure receivers have no donor profile; explain rather than dead-end.
  const handleDonate = () => {
    Alert.alert(
      'Become a donor',
      'To donate blood and receive nearby requests, your account needs donor access. Contact support to enable it.',
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hi, {firstName}</Text>
          <Text style={styles.subGreeting}>Find blood donors near you</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
          <View style={styles.bellWrap}>
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {activeRequests.length > 0 && <View style={styles.badge} />}
          </View>
        </TouchableOpacity>
        <Avatar name={user?.name ?? 'U'} size={40} bgColor={colors.secondary} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>Need Blood?</Text>
            <Text style={styles.heroSub}>Post a request and find donors near you within minutes</Text>
            <Button
              label="Create Blood Request"
              onPress={() => navigation.navigate('CreateRequest')}
              variant="outline"
              style={styles.heroBtn}
              textStyle={{ color: colors.white }}
              size="sm"
            />
          </View>
          <Ionicons name="water" size={60} color="rgba(255,255,255,0.3)" />
        </View>

        <View style={styles.infoRow}>
          {[
            { icon: 'document-text', label: 'Total Requests', value: String(allRequests.length), color: colors.secondary },
            { icon: 'time',          label: 'Active',         value: String(activeRequests.length), color: colors.success },
          ].map(c => (
            <View key={c.label} style={[styles.infoCard, { borderTopColor: c.color }]}>
              <Ionicons name={c.icon as any} size={24} color={c.color} />
              <Text style={[styles.infoVal, { color: c.color }]}>{c.value}</Text>
              <Text style={styles.infoLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickPrimary]}
            onPress={() => navigation.navigate('CreateRequest')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.white} />
            <Text style={styles.quickPrimaryText}>Request Blood</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickOutline]}
            onPress={handleDonate}
            activeOpacity={0.85}
          >
            <Ionicons name="water-outline" size={20} color={colors.primary} />
            <Text style={styles.quickOutlineText}>Donate Blood</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Active Requests</Text>
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.secondary} />
            </View>
          ) : error ? (
            <View style={styles.emptyRequests}>
              <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
              <Text style={styles.emptyText}>Failed to load your requests</Text>
              <TouchableOpacity onPress={() => refetch()}>
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : activeRequests.length === 0 ? (
            <View style={styles.emptyRequests}>
              <Ionicons name="document-outline" size={36} color={colors.grayLight} />
              <Text style={styles.emptyText}>No active requests</Text>
            </View>
          ) : (
            activeRequests.map((r: ApiBloodRequest) => (
              <TouchableOpacity
                key={r.id}
                style={styles.reqCard}
                onPress={() => navigation.navigate('RequestStatus', { requestId: r.id })}
                activeOpacity={0.8}
              >
                <BloodGroupBadge group={r.bloodGroup as any} size="sm" />
                <View style={styles.reqInfo}>
                  <Text style={styles.reqPatient}>{r.patientName}</Text>
                  <Text style={styles.reqHospital}>{r.hospitalName}</Text>
                  <Text style={styles.reqUnits}>{r.unitsNeeded} units • {r.unitsFulfilled} fulfilled</Text>
                </View>
                <View style={styles.reqRight}>
                  <UrgencyBadge level={r.urgency as any} />
                  <Ionicons name="chevron-forward" size={16} color={colors.grayLight} style={{ marginTop: 4 }} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Blood Camps & Events */}
        <CampsPreview onViewAll={() => navigation.getParent()?.navigate('Camps')} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.stepsCard}>
            {[
              { n: '1', title: 'Post a Request', sub: 'Fill in patient & blood details', icon: 'create-outline' },
              { n: '2', title: 'Find Donors',    sub: 'We match nearby donors for you', icon: 'search-outline' },
              { n: '3', title: 'Get Blood',      sub: 'Donor contacts hospital directly', icon: 'heart-outline' },
            ].map((s, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.n}</Text></View>
                <View style={styles.stepLine}>
                  <Ionicons name={s.icon as any} size={20} color={colors.primary} />
                  <View style={styles.stepInfo}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepSub}>{s.sub}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.secondary, margin: spacing.base, borderRadius: radius.xl,
    padding: spacing.lg, ...shadow.md,
  },
  heroLeft: { flex: 1, gap: spacing.sm },
  heroTitle: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.white },
  heroSub: { fontSize: fonts.sizes.sm, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },
  heroBtn: { alignSelf: 'flex-start', borderColor: colors.white },
  infoRow: { flexDirection: 'row', marginHorizontal: spacing.base, gap: spacing.sm, marginBottom: spacing.sm },
  infoCard: {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center', gap: 4, borderTopWidth: 3, ...shadow.sm,
  },
  infoVal: { fontSize: fonts.sizes.xl, fontWeight: '800' },
  infoLabel: { fontSize: fonts.sizes.xs, color: colors.textSecondary, textAlign: 'center' },
  quickRow: {
    flexDirection: 'row', marginHorizontal: spacing.base, gap: spacing.sm, marginBottom: spacing.sm,
  },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.lg, ...shadow.sm,
  },
  quickPrimary: { backgroundColor: colors.primary },
  quickPrimaryText: { color: colors.white, fontWeight: '700', fontSize: fonts.sizes.md },
  quickOutline: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
  quickOutlineText: { color: colors.primary, fontWeight: '700', fontSize: fonts.sizes.md },
  section: { margin: spacing.base, marginTop: spacing.xs },
  sectionTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  loadingBox: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', ...shadow.sm,
  },
  emptyRequests: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', gap: spacing.sm, ...shadow.sm,
  },
  emptyText: { fontSize: fonts.sizes.sm, color: colors.textHint },
  retryText: { fontSize: fonts.sizes.sm, color: colors.secondary, fontWeight: '600' },
  reqCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.sm, ...shadow.sm,
  },
  reqInfo: { flex: 1 },
  reqPatient: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.textPrimary },
  reqHospital: { fontSize: fonts.sizes.sm, color: colors.textSecondary },
  reqUnits: { fontSize: fonts.sizes.xs, color: colors.textHint, marginTop: 2 },
  reqRight: { alignItems: 'flex-end', gap: 2 },
  stepsCard: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.base, ...shadow.sm, gap: spacing.md,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryPale,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.primary },
  stepLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepInfo: { flex: 1 },
  stepTitle: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.textPrimary },
  stepSub: { fontSize: fonts.sizes.xs, color: colors.textSecondary },
});
