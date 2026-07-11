import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ReceiverHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { BloodGroupBadge } from '../../components/Badge';
import { requestsApi, ApiBloodRequest } from '../../api/requests.api';
import { formatBloodGroup, formatRequestStatus } from '../../utils/format';

const STATUS_STEPS = [
  { key: 'PENDING',              label: 'Request Submitted' },
  { key: 'PARTIALLY_FULFILLED', label: 'Donor Found' },
  { key: 'FULFILLED',           label: 'Donation Completed' },
];

const STATUS_BADGE_COLORS: Record<string, string> = {
  PENDING: colors.secondary,
  PARTIALLY_FULFILLED: colors.warning ?? '#F59E0B',
  FULFILLED: colors.success,
  EXPIRED: colors.error,
  CANCELLED: colors.error,
};

function statusStep(status: string): number {
  if (status === 'FULFILLED') return 2;
  if (status === 'PARTIALLY_FULFILLED') return 1;
  return 0;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export const RequestStatusScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ReceiverHomeStackParamList>>();

  const qc = useQueryClient();

  const { data: requests = [], isLoading, refetch } = useQuery<ApiBloodRequest[]>({
    queryKey: ['myRequests'],
    queryFn: () => requestsApi.getMyRequests(),
    refetchInterval: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => requestsApi.cancelRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myRequests'] }),
    onError: (err: any) => Alert.alert(
      'Error',
      err?.response?.data?.error?.message ??
      err?.response?.data?.message ??
      'Failed to cancel request',
    ),
  });

  const handleCancel = (id: string) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this blood request?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate(id) },
    ]);
  };

  const active = requests.find(r => r.status === 'PENDING' || r.status === 'PARTIALLY_FULFILLED');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Requests</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        >

          {/* Active Request Status Card */}
          {active ? (
            <View style={styles.activeCard}>
              <View style={styles.activeHeader}>
                <BloodGroupBadge group={active.bloodGroup as any} size="sm" />
                <View style={styles.activeInfo}>
                  <Text style={styles.activeTitle}>{formatBloodGroup(active.bloodGroup)} Blood • {active.unitsNeeded} Units</Text>
                  <Text style={styles.activeSub}>{active.hospitalName}</Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: STATUS_BADGE_COLORS[active.status] ?? colors.gray }]}>
                  <Text style={styles.statusDotText}>{formatRequestStatus(active.status)}</Text>
                </View>
              </View>

              {/* Timeline */}
              <View style={styles.timeline}>
                {STATUS_STEPS.map((step, i) => {
                  const done = statusStep(active.status) >= i;
                  return (
                    <View key={step.key} style={styles.timelineStep}>
                      <View style={styles.timelineLeft}>
                        <View style={[styles.dot, done && styles.dotDone]}>
                          {done && <Ionicons name="checkmark" size={14} color={colors.white} />}
                        </View>
                        {i < STATUS_STEPS.length - 1 && (
                          <View style={[styles.line, done && styles.lineDone]} />
                        )}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
                        <Text style={styles.stepTime}>{done ? formatShortDate(active.createdAt) : 'Pending'}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.viewMatchesBtn}
                onPress={() => navigation.navigate('MatchingDonors', { requestId: active.id })}
              >
                <Ionicons name="people-outline" size={18} color={colors.white} />
                <Text style={styles.viewMatchesText}>View Matching Donors</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => handleCancel(active.id)}
                disabled={cancelMutation.isPending}
              >
                <Text style={styles.cancelText}>
                  {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Request'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noActiveCard}>
              <Ionicons name="checkmark-circle" size={40} color={colors.grayLight} />
              <Text style={styles.noActiveText}>No active requests</Text>
            </View>
          )}

          {/* All Requests */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Requests</Text>
            {requests.length === 0 ? (
              <Text style={styles.emptyText}>You haven&apos;t created any requests yet.</Text>
            ) : (
              requests.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.reqCard}
                  onPress={() => navigation.navigate('MatchingDonors', { requestId: r.id })}
                >
                  <BloodGroupBadge group={r.bloodGroup as any} size="sm" />
                  <View style={styles.reqInfo}>
                    <Text style={styles.reqPatient}>{r.patientName}</Text>
                    <Text style={styles.reqHospital}>{r.hospitalName}</Text>
                    <Text style={styles.reqId}>#{r.requestCode}</Text>
                  </View>
                  <View style={styles.reqRight}>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_BADGE_COLORS[r.status] ?? colors.gray }]}>
                      <Text style={styles.statusPillText}>{formatRequestStatus(r.status)}</Text>
                    </View>
                    <Text style={styles.reqTime}>{formatShortDate(r.createdAt)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: colors.white, paddingHorizontal: spacing.base,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.textPrimary },
  activeCard: {
    backgroundColor: colors.white, margin: spacing.base, borderRadius: radius.xl,
    padding: spacing.base, ...shadow.md,
  },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  activeInfo: { flex: 1 },
  activeTitle: { fontSize: fonts.sizes.base, fontWeight: '700', color: colors.textPrimary },
  activeSub: { fontSize: fonts.sizes.sm, color: colors.textSecondary },
  statusDot: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusDotText: { fontSize: fonts.sizes.xs, color: colors.white, fontWeight: '700' },
  timeline: { gap: 0 },
  timelineStep: { flexDirection: 'row', gap: spacing.md, minHeight: 56 },
  timelineLeft: { alignItems: 'center', width: 24 },
  dot: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: colors.border, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  lineDone: { backgroundColor: colors.success },
  timelineContent: { flex: 1, paddingBottom: spacing.md },
  stepLabel: { fontSize: fonts.sizes.sm, color: colors.textHint },
  stepLabelDone: { color: colors.textPrimary, fontWeight: '600' },
  stepTime: { fontSize: fonts.sizes.xs, color: colors.textHint, marginTop: 2 },
  viewMatchesBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm,
  },
  viewMatchesText: { fontSize: fonts.sizes.base, color: colors.white, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: spacing.md, marginTop: spacing.xs },
  cancelText: { fontSize: fonts.sizes.sm, color: colors.error, fontWeight: '600' },
  noActiveCard: {
    backgroundColor: colors.white, margin: spacing.base, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: 'center', gap: spacing.sm, ...shadow.sm,
  },
  noActiveText: { fontSize: fonts.sizes.base, color: colors.textHint },
  section: { margin: spacing.base, marginTop: 0 },
  sectionTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  emptyText: { fontSize: fonts.sizes.sm, color: colors.textHint },
  reqCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.sm, ...shadow.sm,
  },
  reqInfo: { flex: 1 },
  reqPatient: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.textPrimary },
  reqHospital: { fontSize: fonts.sizes.xs, color: colors.textSecondary },
  reqId: { fontSize: fonts.sizes.xs, color: colors.textHint, marginTop: 2 },
  reqRight: { alignItems: 'flex-end', gap: 4 },
  statusPill: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusPillText: { fontSize: 10, color: colors.white, fontWeight: '700' },
  reqTime: { fontSize: fonts.sizes.xs, color: colors.textHint },
});
