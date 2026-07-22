import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { campsApi, ApiCamp, CampStatus } from '../../api/camps.api';
import { openInGoogleMaps } from '../../utils/maps';

const TABS: { key: CampStatus; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'past', label: 'Past' },
];

export const CampsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<CampStatus>('upcoming');

  const { data: camps = [], isLoading, error, refetch } = useQuery({
    queryKey: ['camps', tab],
    queryFn: () => campsApi.getCamps(tab),
  });

  const joinMutation = useMutation({
    mutationFn: ({ id, joined }: { id: string; joined: boolean }) =>
      joined ? campsApi.leaveCamp(id) : campsApi.joinCamp(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['camps'] }),
    onError: (err: any) =>
      Alert.alert('Something went wrong', err?.response?.data?.message ?? 'Please try again.'),
  });

  const renderItem = ({ item }: { item: ApiCamp }) => (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.iconWrap}>
          <Ionicons name="water" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          {item.tagline ? <Text style={styles.tagline}>{item.tagline}</Text> : null}
        </View>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
        <Text style={styles.metaText}>{formatDateRange(item.startTime, item.endTime)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
        <Text style={styles.metaText}>{item.venue}{item.city ? `, ${item.city}` : ''}</Text>
      </View>
      {item.attendeeCount > 0 ? (
        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.metaText}>{item.attendeeCount} registered</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {tab !== 'past' ? (
          <TouchableOpacity
            style={[styles.joinBtn, item.isJoined ? styles.joinedBtn : styles.joinActive]}
            onPress={() => joinMutation.mutate({ id: item.id, joined: item.isJoined })}
            disabled={joinMutation.isPending}
          >
            <Ionicons
              name={item.isJoined ? 'checkmark-circle' : 'add-circle-outline'}
              size={16}
              color={item.isJoined ? colors.success : colors.white}
            />
            <Text style={[styles.joinText, item.isJoined && styles.joinedText]}>
              {item.isJoined ? 'Joined' : 'Join'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.pastTag}>
            <Text style={styles.pastText}>Ended</Text>
          </View>
        )}
        {item.lat != null && item.lng != null ? (
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() => openInGoogleMaps(item.lat, item.lng, item.venue)}
          >
            <Ionicons name="navigate" size={15} color={colors.primary} />
            <Text style={styles.mapText}>Directions</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Blood Camps & Events</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.emptyText}>Failed to load camps</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={camps}
          keyExtractor={c => c.id}
          renderItem={renderItem}
          refreshing={isLoading}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color={colors.grayLight} />
              <Text style={styles.emptyText}>
                {isLoading ? 'Loading...' : `No ${tab} camps`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

function formatDateRange(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const date = s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const st = s.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const et = e.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay ? `${date} • ${st} – ${et}` : `${date} ${st} → ${e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${et}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    backgroundColor: colors.white, paddingHorizontal: spacing.base, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.textPrimary },
  tabs: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.base, paddingBottom: spacing.sm,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.full,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  list: { padding: spacing.base, paddingTop: spacing.xs },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.base,
    marginBottom: spacing.sm, gap: spacing.xs, ...shadow.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  iconWrap: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryPale,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.textPrimary },
  tagline: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { flex: 1, fontSize: fonts.sizes.sm, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  joinBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: spacing.sm, borderRadius: radius.md,
  },
  joinActive: { backgroundColor: colors.primary },
  joinedBtn: { backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.success },
  joinText: { color: colors.white, fontWeight: '700', fontSize: fonts.sizes.sm },
  joinedText: { color: colors.success },
  pastTag: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.grayPale,
  },
  pastText: { color: colors.textHint, fontWeight: '600', fontSize: fonts.sizes.sm },
  mapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  mapText: { color: colors.primary, fontWeight: '700', fontSize: fonts.sizes.sm },
  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.md },
  emptyText: { fontSize: fonts.sizes.base, color: colors.textHint },
  retryText: { color: colors.primary, fontWeight: '600' },
});
