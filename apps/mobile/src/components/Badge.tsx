import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, urgencyColors, bloodGroupColors, radius, fonts, spacing } from '../theme';
import { UrgencyLevel, BloodGroup } from '../types';

export const UrgencyBadge: React.FC<{ level: UrgencyLevel }> = ({ level }) => {
  const style = urgencyColors[level] ?? urgencyColors.Medium;
  return (
    <View style={[styles.badge, { backgroundColor: style.bg, borderColor: style.border }]}>
      <Text style={[styles.text, { color: style.text }]}>{level}</Text>
    </View>
  );
};

export const BloodGroupBadge: React.FC<{ group: BloodGroup; size?: 'sm' | 'md' | 'lg' }> = ({ group, size = 'md' }) => {
  const bg = bloodGroupColors[group] ?? colors.primary;
  const dim = size === 'sm' ? 36 : size === 'md' ? 44 : 56;
  const fs = size === 'sm' ? fonts.sizes.xs : size === 'md' ? fonts.sizes.sm : fonts.sizes.md;
  return (
    <View style={[styles.bloodBadge, { backgroundColor: bg, width: dim, height: dim, borderRadius: dim / 2 }]}>
      <Text style={[styles.bloodText, { fontSize: fs }]}>{group}</Text>
    </View>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { bg: string; text: string }> = {
    Pending:   { bg: '#FFF3E0', text: '#E65100' },
    Approved:  { bg: '#E8F5E9', text: '#2E7D32' },
    Completed: { bg: '#E3F2FD', text: '#1565C0' },
    Cancelled: { bg: '#FFEBEE', text: '#C62828' },
    Donated:   { bg: '#E8F5E9', text: '#2E7D32' },
  };
  const s = map[status] ?? map.Pending;
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusText, { color: s.text }]}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: { fontSize: fonts.sizes.xs, fontWeight: '700' },
  bloodBadge: { alignItems: 'center', justifyContent: 'center' },
  bloodText: { color: colors.white, fontWeight: '800' },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: fonts.sizes.xs, fontWeight: '600' },
});
