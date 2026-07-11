import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { DonorHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Header } from '../../components/Header';
import { BloodGroupBadge, UrgencyBadge } from '../../components/Badge';
import { requestsApi, ApiBloodRequest } from '../../api/requests.api';
import { formatBloodGroup } from '../../utils/format';

const FILTERS = ['All', 'A+', 'B+', 'O+', 'AB+'] as const;
type Filter = typeof FILTERS[number];

export const NearbyRequestsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<DonorHomeStackParamList>>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  const { data: requests = [], isLoading, error, refetch } = useQuery({
    queryKey: ['nearbyRequests'],
    queryFn: () => requestsApi.getNearbyRequests(50),
    retry: 1,
  });

  const filtered = requests
    .filter(r => filter === 'All' || formatBloodGroup(r.bloodGroup) === filter)
    .filter(r =>
      !search ||
      formatBloodGroup(r.bloodGroup).toLowerCase().includes(search.toLowerCase()) ||
      r.hospitalName.toLowerCase().includes(search.toLowerCase())
    );

  const renderItem = ({ item }: { item: ApiBloodRequest }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('RequestDetails', { requestId: item.id })}
      activeOpacity={0.8}
    >
      <BloodGroupBadge group={item.bloodGroup as any} size="md" />
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.units}>{item.unitsNeeded} Units</Text>
          <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.hospital}>{item.hospitalName}</Text>
        <Text style={styles.loc}>
          {item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km away` : 'Distance unknown'}
        </Text>
      </View>
      <View style={styles.right}>
        <UrgencyBadge level={item.urgency} />
        <Ionicons name="chevron-forward" size={16} color={colors.grayLight} style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Nearby Requests" onBack={() => navigation.goBack()} />
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.emptyText}>Failed to load requests</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
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
          placeholder="Search by blood group or hospital"
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

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        refreshing={isLoading}
        onRefresh={refetch}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={48} color={colors.grayLight} />
            <Text style={styles.emptyText}>
              {isLoading ? 'Loading...' : 'No requests nearby'}
            </Text>
          </View>
        }
      />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    margin: spacing.base, backgroundColor: colors.white,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 46,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: fonts.sizes.base, color: colors.textPrimary },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.base, gap: spacing.sm, marginBottom: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.full, backgroundColor: colors.white,
    borderWidth: 1.5, borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: fonts.sizes.sm, color: colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: colors.white },
  list: { padding: spacing.base, paddingTop: spacing.xs },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.sm, ...shadow.sm,
  },
  info: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  units: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.textPrimary },
  time: { fontSize: fonts.sizes.xs, color: colors.textHint },
  hospital: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  loc: { fontSize: fonts.sizes.xs, color: colors.textHint, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.md },
  emptyText: { fontSize: fonts.sizes.base, color: colors.textHint },
  retryBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.base },
  retryText: { color: colors.primary, fontWeight: '600' },
});
