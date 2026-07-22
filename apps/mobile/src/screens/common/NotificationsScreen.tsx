import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Header } from '../../components/Header';
import { notificationsApi, ApiNotification } from '../../api/notifications.api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const notifIcon = (type: string): { icon: IconName; color: string; bg: string } => {
  switch (type) {
    case 'MATCH_FOUND':          return { icon: 'person-add',       color: colors.primary,   bg: colors.primaryPale };
    case 'MATCH_ACCEPTED':       return { icon: 'checkmark-circle', color: colors.success,   bg: colors.successLight };
    case 'MATCH_DECLINED':       return { icon: 'close-circle',     color: colors.error,     bg: '#FFEBEE' };
    case 'REQUEST_FULFILLED':    return { icon: 'heart',            color: colors.success,   bg: colors.successLight };
    case 'REQUEST_EXPIRED':      return { icon: 'alarm',            color: colors.warning,   bg: colors.warningLight };
    case 'CAMP_REMINDER':        return { icon: 'calendar',         color: colors.primary,   bg: colors.primaryPale };
    case 'DONATION_ANNIVERSARY': return { icon: 'gift',             color: colors.primary,   bg: colors.primaryPale };
    default:                     return { icon: 'notifications',    color: colors.secondary, bg: '#E3F2FD' };
  }
};

const TABS = ['All', 'Requests', 'Reminders', 'Updates'] as const;
type Tab = typeof TABS[number];

const REQUEST_TYPES = new Set(['MATCH_FOUND', 'MATCH_ACCEPTED', 'MATCH_DECLINED', 'REQUEST_FULFILLED', 'REQUEST_EXPIRED']);
const REMINDER_TYPES = new Set(['CAMP_REMINDER', 'DONATION_ANNIVERSARY']);

const inTab = (type: string, tab: Tab): boolean => {
  if (tab === 'All') return true;
  if (tab === 'Requests') return REQUEST_TYPES.has(type);
  if (tab === 'Reminders') return REMINDER_TYPES.has(type);
  return !REQUEST_TYPES.has(type) && !REMINDER_TYPES.has(type); // Updates = everything else
};

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('All');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll(1),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data?.unreadCount ?? 0;
  const notifications = (data?.notifications ?? []).filter(n => inTab(n.type, tab));

  const renderItem = ({ item }: { item: ApiNotification }) => {
    const { icon, color, bg } = notifIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.card, !item.isRead && styles.unread]}
        activeOpacity={0.8}
        onPress={() => { if (!item.isRead) markReadMutation.mutate(item.id); }}
      >
        <View style={[styles.iconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.message} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        {!item.isRead && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Notifications"
        onBack={() => navigation.goBack()}
        rightElement={
          unread > 0 ? (
            <TouchableOpacity onPress={() => markAllMutation.mutate()} hitSlop={8}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
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
          data={notifications}
          keyExtractor={n => n.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            unread > 0 ? (
              <TouchableOpacity style={styles.unreadBanner} onPress={() => markAllMutation.mutate()}>
                <Ionicons name="notifications" size={16} color={colors.primary} />
                <Text style={styles.unreadText}>
                  {unread} unread notification{unread > 1 ? 's' : ''}
                </Text>
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.grayLight} />
              <Text style={styles.emptyText}>No notifications yet</Text>
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
  tabs: {
    flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm, backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: fonts.sizes.xs, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  badge: {
    backgroundColor: colors.primary, borderRadius: radius.full ?? 999,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { fontSize: fonts.sizes.xs, color: colors.white, fontWeight: '700' },
  list: { padding: spacing.base },
  unreadBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.primaryPale, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.sm,
  },
  unreadText: { fontSize: fonts.sizes.sm, color: colors.primary, fontWeight: '600', flex: 1 },
  markAllText: { fontSize: fonts.sizes.sm, color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.sm, ...shadow.sm,
  },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  info: { flex: 1 },
  title: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.textPrimary },
  message: { fontSize: fonts.sizes.xs, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
  time: { fontSize: fonts.sizes.xs, color: colors.textHint, marginTop: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4, flexShrink: 0 },
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyText: { fontSize: fonts.sizes.base, color: colors.textHint },
});
