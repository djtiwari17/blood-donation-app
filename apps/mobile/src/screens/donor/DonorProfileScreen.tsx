import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Switch, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DonorProfileStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Avatar } from '../../components/Avatar';
import { BloodGroupBadge } from '../../components/Badge';
import { useAuthStore } from '../../store/auth.store';
import { donorsApi } from '../../api/donors.api';

type Props = { navigation: NativeStackNavigationProp<DonorProfileStackParamList, 'DonorProfile'> };

const BG_MAP: Record<string, string> = {
  A_POS: 'A+', A_NEG: 'A-', B_POS: 'B+', B_NEG: 'B-',
  AB_POS: 'AB+', AB_NEG: 'AB-', O_POS: 'O+', O_NEG: 'O-',
};

export const DonorProfileScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user, logout } = useAuthStore();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['donorProfile'],
    queryFn: donorsApi.getProfile,
  });

  const toggleMutation = useMutation({
    mutationFn: (isAvailable: boolean) => donorsApi.updateProfile({ isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['donorProfile'] }),
    onError: () => Alert.alert('Error', 'Failed to update availability'),
  });

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const bloodGroup = user?.bloodGroup ? (BG_MAP[user.bloodGroup] ?? user.bloodGroup) : 'A+';
  const isVerified = user?.verifStatus === 'VERIFIED';

  const menuItems = [
    { icon: 'time-outline',           label: 'Donation History',    onPress: () => {} },
    { icon: 'notifications-outline',  label: 'Notifications',       onPress: () => navigation.navigate('Notifications') },
    { icon: 'shield-outline',         label: 'Privacy & Safety',    onPress: () => {} },
    { icon: 'help-circle-outline',    label: 'Help & Support',      onPress: () => {} },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.cover}>
          <View style={styles.avatarWrap}>
            <Avatar name={user?.name ?? 'U'} size={80} />
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
            )}
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <BloodGroupBadge group={bloodGroup as any} size="md" />
        </View>

        {/* Availability Toggle */}
        <View style={styles.availCard}>
          <View style={styles.availLeft}>
            <Ionicons name="heart" size={20} color={colors.primary} />
            <View>
              <Text style={styles.availTitle}>Available to Donate</Text>
              <Text style={styles.availSub}>Toggle to update your availability</Text>
            </View>
          </View>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Switch
              value={profile?.isAvailable ?? true}
              onValueChange={v => toggleMutation.mutate(v)}
              disabled={toggleMutation.isPending}
              thumbColor={colors.white}
              trackColor={{ false: colors.grayLight, true: colors.primary }}
            />
          )}
        </View>

        {/* Donation Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Donations',   value: profile?.totalDonations ?? 0 },
            { label: 'Lives Saved', value: profile?.livesSaved ?? 0 },
            { label: 'Response %',  value: profile ? `${Math.round(profile.responseRate * 100)}%` : '—' },
          ].map(s => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statVal}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {!profile?.isEligible && profile?.nextEligibleDate && (
          <View style={styles.eligibilityBanner}>
            <Ionicons name="time-outline" size={16} color={colors.warning} />
            <Text style={styles.eligibilityText}>
              Next eligible to donate:{' '}
              {new Date(profile.nextEligibleDate).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </Text>
          </View>
        )}

        {/* Menu */}
        <View style={styles.menu}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={20} color={colors.textSecondary} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.grayLight} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  cover: {
    backgroundColor: colors.primary, paddingTop: spacing.xl,
    paddingBottom: spacing.xl + 10, alignItems: 'center', gap: spacing.sm,
  },
  avatarWrap: { position: 'relative' },
  verifiedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: colors.white, borderRadius: 10, width: 20, height: 20,
  },
  name: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.white },
  phone: { fontSize: fonts.sizes.sm, color: 'rgba(255,255,255,0.8)' },
  availCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, margin: spacing.base, borderRadius: radius.lg,
    padding: spacing.md, ...shadow.sm,
  },
  availLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  availTitle: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.textPrimary },
  availSub: { fontSize: fonts.sizes.xs, color: colors.textHint },
  statsRow: {
    flexDirection: 'row', backgroundColor: colors.white,
    marginHorizontal: spacing.base, borderRadius: radius.lg,
    padding: spacing.md, ...shadow.sm, marginBottom: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: fonts.sizes.xs, color: colors.textHint },
  eligibilityBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.warningLight, marginHorizontal: spacing.base,
    borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md,
  },
  eligibilityText: { fontSize: fonts.sizes.xs, color: colors.warning, flex: 1 },
  menu: {
    backgroundColor: colors.white, marginHorizontal: spacing.base,
    borderRadius: radius.lg, ...shadow.sm, overflow: 'hidden', marginBottom: spacing.md,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.base, borderBottomWidth: 0.5, borderBottomColor: colors.grayPale,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.grayPale, alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: fonts.sizes.base, color: colors.textPrimary },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center',
    marginHorizontal: spacing.base, backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.base, ...shadow.sm, borderWidth: 1, borderColor: '#FFEBEE',
  },
  logoutText: { fontSize: fonts.sizes.base, color: colors.error, fontWeight: '600' },
});
