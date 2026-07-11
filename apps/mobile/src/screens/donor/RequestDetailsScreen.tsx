import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { DonorHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Header } from '../../components/Header';
import { BloodGroupBadge, UrgencyBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { requestsApi, ApiBloodRequest } from '../../api/requests.api';
import { matchingApi } from '../../api/matching.api';
import { formatBloodGroup, formatUrgency } from '../../utils/format';

type Props = {
  navigation: NativeStackNavigationProp<DonorHomeStackParamList, 'RequestDetails'>;
  route: RouteProp<DonorHomeStackParamList, 'RequestDetails'>;
};

export const RequestDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { requestId } = route.params;
  const queryClient = useQueryClient();
  const [responding, setResponding] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { data: request, isLoading, error } = useQuery<ApiBloodRequest>({
    queryKey: ['request', requestId],
    queryFn: () => requestsApi.getRequestById(requestId),
  });

  const handleRespond = (action: 'ACCEPT' | 'DECLINE') => {
    if (!request?.myMatch) return;
    const matchId = request.myMatch.id;
    const label = action === 'ACCEPT' ? 'donate' : 'decline';

    Alert.alert(
      action === 'ACCEPT' ? 'Confirm Donation' : 'Decline Request',
      action === 'ACCEPT'
        ? `Confirm that you will donate ${formatBloodGroup(request.bloodGroup)} blood at ${request.hospitalName}?`
        : 'Are you sure you want to decline this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'ACCEPT' ? 'Yes, I Can Donate' : 'Decline',
          style: action === 'DECLINE' ? 'destructive' : 'default',
          onPress: async () => {
            setResponding(true);
            try {
              await matchingApi.respondToMatch(matchId, action);
              queryClient.invalidateQueries({ queryKey: ['request', requestId] });
              if (action === 'ACCEPT') {
                Alert.alert('Thank You!', 'Your response has been recorded. The hospital will contact you shortly.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? `Failed to ${label}`);
            } finally {
              setResponding(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmDonation = () => {
    if (!request?.myMatch) return;
    const matchId = request.myMatch.id;
    Alert.alert(
      'Confirm Donation',
      'Did you actually donate blood for this request? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, I Donated',
          onPress: async () => {
            setConfirming(true);
            try {
              await matchingApi.confirmDonation(matchId);
              queryClient.invalidateQueries({ queryKey: ['request', requestId] });
              Alert.alert('Thank You!', 'Your donation has been recorded. You have saved a life!');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? 'Failed to confirm donation');
            } finally {
              setConfirming(false);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !request) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Header title="Request Details" onBack={() => navigation.goBack()} />
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>Failed to load request details</Text>
      </View>
    );
  }

  const myMatch = request.myMatch;
  const matchAccepted = myMatch?.status === 'ACCEPTED';
  const matchDonated = myMatch?.status === 'DONATED';
  const matchDeclined = myMatch?.status === 'CANCELLED' || myMatch?.status === 'TIMED_OUT';
  const urgencyLabel = formatUrgency(request.urgency);

  const row = (icon: string, label: string, value: string, color?: string) => (
    <View style={styles.detailRow} key={label}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon as any} size={18} color={color ?? colors.gray} />
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Request Details"
        onBack={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => navigation.navigate('ReportUser', {
              userId: request.receiverId ?? '',
              userName: request.patientName,
            })}
          >
            <Ionicons name="flag-outline" size={22} color={colors.gray} />
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <BloodGroupBadge group={request.bloodGroup as any} size="lg" />
          <View style={styles.heroInfo}>
            <Text style={styles.heroUnits}>{request.unitsNeeded} Units Needed</Text>
            <UrgencyBadge level={urgencyLabel as any} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patient Information</Text>
          {row('person-outline', 'Patient Name', request.patientName)}
          {row('business-outline', 'Hospital', request.hospitalName)}
          {request.distanceKm != null && row('location-outline', 'Distance', `${request.distanceKm.toFixed(1)} km away`, colors.primary)}
          {row('time-outline', 'Required By', formatDate(request.requiredBy), colors.error)}
          {row('barcode-outline', 'Request Code', request.requestCode)}
        </View>

        {/* Match status card */}
        {myMatch && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Match Status</Text>
            <View style={styles.matchStatus}>
              <Ionicons
                name={
                  matchDonated ? 'heart' :
                  matchAccepted ? 'checkmark-circle' :
                  matchDeclined ? 'close-circle' : 'time-outline'
                }
                size={22}
                color={
                  matchDonated ? colors.primary :
                  matchAccepted ? colors.success :
                  matchDeclined ? colors.error : colors.secondary
                }
              />
              <Text style={[styles.matchStatusText, {
                color: matchDonated ? colors.primary :
                       matchAccepted ? colors.success :
                       matchDeclined ? colors.error : colors.secondary,
              }]}>
                {matchDonated  ? 'Donation confirmed — thank you!'
                  : matchAccepted ? 'You accepted — please donate soon'
                  : matchDeclined ? 'You declined this request'
                  : 'Awaiting your response'}
              </Text>
            </View>
            {matchAccepted && !matchDonated && (
              <Text style={styles.matchHint}>
                The receiver can see your contact details. Confirm once you have donated.
              </Text>
            )}
          </View>
        )}

        <View style={styles.btnRow}>
          {myMatch && !matchAccepted && !matchDonated && !matchDeclined ? (
            <>
              <Button
                label="Decline"
                onPress={() => handleRespond('DECLINE')}
                variant="outline"
                fullWidth={false}
                style={styles.callBtn}
                loading={responding}
              />
              <Button
                label="I Can Donate"
                onPress={() => handleRespond('ACCEPT')}
                variant="primary"
                fullWidth={false}
                style={styles.donateBtn}
                loading={responding}
              />
            </>
          ) : matchAccepted && !matchDonated ? (
            <Button
              label="Confirm I Donated"
              onPress={handleConfirmDonation}
              variant="primary"
              loading={confirming}
              style={{ flex: 1 }}
            />
          ) : matchDonated ? (
            <Button
              label="Donation Confirmed!"
              onPress={() => {}}
              variant="secondary"
              disabled
              style={{ flex: 1 }}
            />
          ) : !myMatch ? (
            <View style={styles.noMatchWrap}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textHint} />
              <Text style={styles.noMatchText}>
                You haven&apos;t been matched to this request yet.
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: fonts.sizes.base, color: colors.textHint, marginTop: spacing.md },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.base,
    backgroundColor: colors.white, padding: spacing.lg, margin: spacing.base,
    borderRadius: radius.xl, ...shadow.sm,
  },
  heroInfo: { flex: 1, gap: spacing.sm },
  heroUnits: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.textPrimary },
  reportBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.base,
    marginHorizontal: spacing.base, marginBottom: spacing.md, ...shadow.sm,
  },
  cardTitle: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  detailRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  detailIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.grayPale, alignItems: 'center', justifyContent: 'center',
  },
  detailContent: { flex: 1, justifyContent: 'center' },
  detailLabel: { fontSize: fonts.sizes.xs, color: colors.textHint },
  detailValue: { fontSize: fonts.sizes.base, color: colors.textPrimary, fontWeight: '500', marginTop: 2 },
  matchStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  matchStatusText: { fontSize: fonts.sizes.base, fontWeight: '600' },
  matchHint: { fontSize: fonts.sizes.sm, color: colors.textHint, marginTop: spacing.sm },
  btnRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.base, marginTop: spacing.xs },
  callBtn: { flex: 1 },
  donateBtn: { flex: 1 },
  noMatchWrap: {
    flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'center',
    backgroundColor: colors.grayPale, borderRadius: radius.md, padding: spacing.md,
  },
  noMatchText: { flex: 1, fontSize: fonts.sizes.sm, color: colors.textHint },
});
