import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { DonorHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius } from '../../theme';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';
import { reportsApi, ReportReason } from '../../api/reports.api';

const REASONS: { label: string; value: ReportReason }[] = [
  { label: 'Fake Profile / Information', value: 'FAKE_PROFILE' },
  { label: 'Spam',                        value: 'SPAM' },
  { label: 'Harassment',                  value: 'HARASSMENT' },
  { label: 'Wrong Information',           value: 'WRONG_INFO' },
  { label: 'Other',                       value: 'OTHER' },
];

export const ReportUserScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<DonorHomeStackParamList, 'ReportUser'>>();
  const { userId, userName } = route.params;

  const [reason, setReason] = useState<ReportReason | ''>('');
  const [reasonError, setReasonError] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      setReasonError('Please select a reason for reporting this user.');
      return;
    }
    setLoading(true);
    try {
      await reportsApi.createReport(userId, reason, details.trim() || undefined);
      Alert.alert(
        'Report Submitted',
        'Thank you. Our safety team will review this within 24 hours.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to submit report. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Report User" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={24} color={colors.gray} />
          </View>
          <View>
            <Text style={styles.reportingLabel}>Reporting</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
        </View>

        <Text style={styles.label}>Why are you reporting this user?</Text>

        {REASONS.map(r => (
          <TouchableOpacity
            key={r.value}
            style={styles.radioRow}
            onPress={() => { setReason(r.value); setReasonError(''); }}
            activeOpacity={0.7}
          >
            <View style={[styles.radio, reason === r.value && styles.radioSelected]}>
              {reason === r.value && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.radioText}>{r.label}</Text>
          </TouchableOpacity>
        ))}
        {reasonError ? <Text style={styles.errorText}>{reasonError}</Text> : null}

        <Text style={[styles.label, { marginTop: spacing.md }]}>Additional details (optional)</Text>
        <TextInput
          style={styles.textarea}
          multiline
          numberOfLines={4}
          placeholder="Write details..."
          placeholderTextColor={colors.textHint}
          value={details}
          onChangeText={setDetails}
          textAlignVertical="top"
          maxLength={500}
        />

        <View style={styles.notice}>
          <Ionicons name="shield-outline" size={16} color={colors.secondary} />
          <Text style={styles.noticeText}>
            Your report is anonymous and will be reviewed by our safety team.
          </Text>
        </View>

        <Button label="Submit Report" onPress={handleSubmit} loading={loading} variant="danger" />
        <View style={{ height: 32 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.base },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.grayPale, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg,
  },
  userAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  reportingLabel: { fontSize: fonts.sizes.xs, color: colors.textHint },
  userName: { fontSize: fonts.sizes.base, fontWeight: '700', color: colors.textPrimary },
  label: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  radioText: { fontSize: fonts.sizes.base, color: colors.textPrimary },
  textarea: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, minHeight: 100, fontSize: fonts.sizes.base,
    color: colors.textPrimary, marginBottom: spacing.md, marginTop: spacing.xs,
  },
  notice: {
    flexDirection: 'row', gap: spacing.xs, backgroundColor: '#E3F2FD',
    padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, alignItems: 'flex-start',
  },
  noticeText: { flex: 1, fontSize: fonts.sizes.xs, color: colors.secondary, lineHeight: 18 },
  errorText: { fontSize: fonts.sizes.xs, color: colors.error, marginTop: spacing.xs },
});
