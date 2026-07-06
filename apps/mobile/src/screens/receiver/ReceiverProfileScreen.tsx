import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { ReceiverProfileStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../../store/auth.store';
import { requestsApi } from '../../api/requests.api';

type Props = { navigation: NativeStackNavigationProp<ReceiverProfileStackParamList, 'ReceiverProfile'> };

export const ReceiverProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();

  const { data: requests = [] } = useQuery({
    queryKey: ['myRequests'],
    queryFn: requestsApi.getMyRequests,
  });

  const fulfilled = requests.filter(r => r.status === 'FULFILLED').length;
  const pending   = requests.filter(r => r.status === 'PENDING' || r.status === 'PARTIALLY_FULFILLED').length;

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const menuItems = [
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    { icon: 'shield-outline',        label: 'Privacy & Safety', onPress: () => {} },
    { icon: 'help-circle-outline',   label: 'Help & Support',   onPress: () => {} },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.cover}>
          <Avatar name={user?.name ?? 'U'} size={80} bgColor={colors.secondary} />
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <View style={styles.roleChip}>
            <Ionicons name="person" size={14} color={colors.secondary} />
            <Text style={styles.roleText}>Blood Receiver</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Requests',  value: requests.length, icon: 'document-text' },
            { label: 'Fulfilled', value: fulfilled,        icon: 'checkmark-circle' },
            { label: 'Active',    value: pending,          icon: 'time' },
          ].map(s => (
            <View key={s.label} style={styles.stat}>
              <Ionicons name={s.icon as any} size={20} color={colors.secondary} />
              <Text style={styles.statVal}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

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
    backgroundColor: colors.secondary, paddingTop: spacing.xl,
    paddingBottom: spacing.xl, alignItems: 'center', gap: spacing.sm,
  },
  name: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.white },
  phone: { fontSize: fonts.sizes.sm, color: 'rgba(255,255,255,0.8)' },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.white, borderRadius: radius.full,
    paddingVertical: 5, paddingHorizontal: spacing.md,
  },
  roleText: { fontSize: fonts.sizes.sm, color: colors.secondary, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row', backgroundColor: colors.white,
    margin: spacing.base, borderRadius: radius.lg, padding: spacing.md,
    ...shadow.sm,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: fonts.sizes.xs, color: colors.textHint },
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
