import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors, fonts, spacing, radius, shadow } from '../theme';
import { campsApi } from '../api/camps.api';

/**
 * Blood Camps & Events home preview — shows the next couple of upcoming camps.
 * "View All" jumps to the Camps tab (wired via onViewAll by each dashboard).
 */
type Props = {
  onViewAll?: () => void;
};

export const CampsPreview: React.FC<Props> = ({ onViewAll }) => {
  const { data: camps = [], isLoading } = useQuery({
    queryKey: ['camps', 'upcoming'],
    queryFn: () => campsApi.getCamps('upcoming'),
    retry: 1,
  });

  const top = camps.slice(0, 2);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Blood Camps & Events</Text>
        {onViewAll && camps.length > 0 ? (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : top.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={32} color={colors.grayLight} />
          <Text style={styles.emptyText}>No upcoming camps yet</Text>
          <Text style={styles.emptySub}>Check back soon for donation drives near you</Text>
        </View>
      ) : (
        top.map(c => (
          <TouchableOpacity key={c.id} style={styles.campRow} onPress={onViewAll} activeOpacity={0.8}>
            <View style={styles.iconWrap}>
              <Ionicons name="water" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.campName} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.campMeta} numberOfLines={1}>
                {formatDate(c.startTime)} • {c.venue}
              </Text>
            </View>
            {c.isJoined ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.grayLight} />
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  section: { margin: spacing.base, marginTop: spacing.sm },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.textPrimary },
  viewAll: { fontSize: fonts.sizes.sm, color: colors.primary, fontWeight: '600' },
  emptyCard: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', gap: spacing.xs, ...shadow.sm,
  },
  emptyText: { fontSize: fonts.sizes.sm, color: colors.textSecondary, fontWeight: '600' },
  emptySub: { fontSize: fonts.sizes.xs, color: colors.textHint, textAlign: 'center' },
  campRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.sm, ...shadow.sm,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primaryPale,
    alignItems: 'center', justifyContent: 'center',
  },
  campName: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.textPrimary },
  campMeta: { fontSize: fonts.sizes.xs, color: colors.textSecondary, marginTop: 2 },
});
