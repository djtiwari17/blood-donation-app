import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { BloodGroupBadge } from '../../components/Badge';
import { donorsApi, DonationHistoryMatch } from '../../api/donors.api';

type Tab = 'All' | 'Donated' | 'Cancelled';

const STATUS_ICON: Record<string, { name: string; color: string }> = {
  DONATED:   { name: 'checkmark-circle', color: colors.success },
  CANCELLED: { name: 'close-circle',     color: colors.error },
  TIMED_OUT: { name: 'time',             color: colors.warning },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const DonationHistoryScreen: React.FC = () => {
  const [tab, setTab] = useState<Tab>('All');
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['donationHistory'],
    queryFn: () => donorsApi.getDonationHistory(1),
  });

  const allMatches = data?.matches ?? [];
  const displayed =
    tab === 'All'      ? allMatches :
    tab === 'Donated'  ? allMatches.filter(m => m.status === 'DONATED') :
                         allMatches.filter(m => m.status === 'CANCELLED' || m.status === 'TIMED_OUT');

  const donated = allMatches.filter(m => m.status === 'DONATED').length;
  const cancelled = allMatches.filter(m => m.status !== 'DONATED').length;

  const renderItem = ({ item }: { item: DonationHistoryMatch }) => {
    const si = STATUS_ICON[item.status] ?? STATUS_ICON.DONATED;
    return (
      <View style={styles.card}>
        <BloodGroupBadge group={item.request.bloodGroup as any} size="md" />
        <View style={styles.info}>
          <Text style={styles.date}>{formatDate(item.donatedAt ?? item.notifiedAt)}</Text>
          <Text style={styles.hospital}>{item.request.hospitalName}</Text>
          <Text style={styles.patient}>Patient: {item.request.patientName}</Text>
        </View>
        <Ionicons name={si.name as any} size={22} color={si.color} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Donation History</Text>
        <View style={styles.medalRow}>
          <Ionicons name="trophy" size={18} color="#F57F17" />
          <Text style={styles.medals}>{donated} donation{donated !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: 'Total',    value: allMatches.length, color: colors.secondary },
          { label: 'Donated',  value: donated,           color: colors.success },
          { label: 'Cancelled',value: cancelled,         color: colors.error },
        ].map(s => (
          <View key={s.label} style={[styles.statBox, { borderColor: s.color }]}>
            <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tabs}>
        {(['All', 'Donated', 'Cancelled'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color={colors.grayLight} />
              <Text style={styles.emptyText}>No {tab.toLowerCase()} donations</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.white, paddingHorizontal: spacing.base,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.textPrimary },
  medalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  medals: { fontSize: fonts.sizes.sm, color: '#F57F17', fontWeight: '700' },
  statsRow: { flexDirection: 'row', margin: spacing.base, gap: spacing.sm },
  statBox: {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center', borderTopWidth: 3, ...shadow.sm,
  },
  statVal: { fontSize: fonts.sizes.xl, fontWeight: '800' },
  statLabel: { fontSize: fonts.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  tabs: {
    flexDirection: 'row', backgroundColor: colors.white,
    marginHorizontal: spacing.base, borderRadius: radius.lg, overflow: 'hidden',
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  list: { padding: spacing.base, paddingTop: spacing.xs },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.sm, ...shadow.sm,
  },
  info: { flex: 1 },
  date: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.textPrimary },
  hospital: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  patient: { fontSize: fonts.sizes.xs, color: colors.textHint, marginTop: 2, fontStyle: 'italic' },
  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.md },
  emptyText: { fontSize: fonts.sizes.base, color: colors.textHint },
});
