import React from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ReceiverHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Header } from '../../components/Header';
import { Avatar } from '../../components/Avatar';
import { BloodGroupBadge } from '../../components/Badge';
import { requestsApi, ApiMatch } from '../../api/requests.api';

type Props = {
  navigation: NativeStackNavigationProp<ReceiverHomeStackParamList, 'MatchingDonors'>;
  route: RouteProp<ReceiverHomeStackParamList, 'MatchingDonors'>;
};

const STATUS_COLORS: Record<string, string> = {
  ACCEPTED: colors.success,
  NOTIFIED: colors.secondary,
  CANCELLED: colors.error,
  TIMED_OUT: colors.error,
  DONATED: colors.success,
};

const isPhoneVisible = (match: ApiMatch) => match.status === 'ACCEPTED';

export const MatchingDonorsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { requestId } = route.params;

  const { data: matches = [], isLoading, error, refetch } = useQuery({
    queryKey: ['matches', requestId],
    queryFn: () => requestsApi.getMatchesForRequest(requestId),
    refetchInterval: 30_000, // poll every 30s for new acceptances
  });

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() =>
      Alert.alert('Unable to open dialer')
    );
  };

  const renderDonor = ({ item }: { item: ApiMatch }) => {
    const phoneVisible = isPhoneVisible(item);
    return (
      <View style={styles.card}>
        <Avatar name={item.donor.name} size={48} bgColor={colors.primary} />
        <View style={styles.info}>
          <Text style={styles.name}>{item.donor.name}</Text>
          <Text style={styles.distance}>{item.distanceKm.toFixed(1)} km away</Text>
          {item.donor.verifStatus === 'VERIFIED' && (
            <View style={styles.verified}>
              <Ionicons name="checkmark-circle" size={13} color={colors.success} />
              <Text style={styles.verifiedText}>Verified Donor</Text>
            </View>
          )}
          <Text style={[styles.status, { color: STATUS_COLORS[item.status] ?? colors.gray }]}>
            {item.status}
          </Text>
        </View>
        <View style={styles.right}>
          <BloodGroupBadge group={item.donor.bloodGroup as any} size="sm" />
          {phoneVisible ? (
            <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(item.donor.phone)}>
              <Ionicons name="call" size={20} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.lockedBtn}>
              <Ionicons name="lock-closed" size={16} color={colors.gray} />
            </View>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Matching Donors" onBack={() => navigation.goBack()} />

      <View style={styles.banner}>
        <Ionicons name="people" size={22} color={colors.success} />
        <Text style={styles.bannerText}>
          {matches.length > 0
            ? `We found ${matches.length} donor${matches.length !== 1 ? 's' : ''} for you`
            : 'Searching for donors nearby...'}
        </Text>
      </View>

      {matches.length > 0 && (
        <View style={styles.hint}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textHint} />
          <Text style={styles.hintText}>
            Donor contact is revealed only after they accept your request
          </Text>
        </View>
      )}

      <FlatList
        data={matches}
        keyExtractor={d => d.id}
        renderItem={renderDonor}
        contentContainerStyle={styles.list}
        refreshing={isLoading}
        onRefresh={refetch}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={48} color={colors.grayLight} />
            <Text style={styles.emptyText}>No donors found yet</Text>
            <Text style={styles.emptySub}>We&apos;ll expand the search radius automatically</Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.statusBtn}
            onPress={() => navigation.navigate('RequestStatus', { requestId })}
          >
            <Text style={styles.statusBtnText}>Track Request Status</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.successLight, padding: spacing.md,
    margin: spacing.base, borderRadius: radius.lg,
  },
  bannerText: { fontSize: fonts.sizes.base, color: colors.textPrimary },
  hint: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.base, marginBottom: spacing.sm,
  },
  hintText: { fontSize: fonts.sizes.xs, color: colors.textHint },
  list: { padding: spacing.base, paddingTop: spacing.xs },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.sm, ...shadow.sm,
  },
  info: { flex: 1 },
  name: { fontSize: fonts.sizes.base, fontWeight: '700', color: colors.textPrimary },
  distance: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  verifiedText: { fontSize: fonts.sizes.xs, color: colors.success, fontWeight: '600' },
  status: { fontSize: fonts.sizes.xs, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  right: { alignItems: 'center', gap: spacing.sm },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center',
  },
  lockedBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.grayPale, alignItems: 'center', justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.sm },
  emptyText: { fontSize: fonts.sizes.base, color: colors.textHint },
  emptySub: { fontSize: fonts.sizes.sm, color: colors.textHint, textAlign: 'center' },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.base,
    marginTop: spacing.sm, borderWidth: 1.5, borderColor: colors.primary, ...shadow.sm,
  },
  statusBtnText: { fontSize: fonts.sizes.base, color: colors.primary, fontWeight: '700' },
});
