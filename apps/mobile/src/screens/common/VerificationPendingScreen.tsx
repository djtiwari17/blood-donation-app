import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Button } from '../../components/Button';

export const VerificationPendingScreen: React.FC = () => {
  const navigation = useNavigation();

  const steps = [
    { label: 'Profile Created', done: true },
    { label: 'OTP Verified', done: true },
    { label: 'Document Review', done: false },
    { label: 'Account Activated', done: false },
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.iconWrap}>
        <Ionicons name="time" size={56} color={colors.warning} />
      </View>

      <Text style={styles.title}>Verification Pending</Text>
      <Text style={styles.subtitle}>
        Your profile is under review.{'\n'}You will be notified once your account is verified.
      </Text>

      {/* Steps */}
      <View style={styles.stepsCard}>
        <Text style={styles.stepsTitle}>Verification Progress</Text>
        {steps.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
              <Ionicons
                name={step.done ? 'checkmark' : 'ellipse-outline'}
                size={14}
                color={step.done ? colors.white : colors.grayLight}
              />
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.stepLine, step.done && styles.stepLineDone]} />
            )}
            <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={colors.secondary} />
        <Text style={styles.infoText}>
          Verification typically takes 24-48 hours. You can still browse the app but cannot donate until verified.
        </Text>
      </View>

      <Button label="Go Back" onPress={() => navigation.goBack()} variant="outline" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: spacing.xl, paddingTop: 60 },
  back: { marginBottom: spacing.xl },
  iconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.warningLight, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: spacing.xl,
  },
  title: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: fonts.sizes.base, color: colors.textSecondary, textAlign: 'center',
    lineHeight: 24, marginTop: spacing.sm, marginBottom: spacing.xl,
  },
  stepsCard: {
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.base,
    marginBottom: spacing.lg, ...shadow.md,
  },
  stepsTitle: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, position: 'relative', minHeight: 40 },
  stepDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  stepDotDone: { backgroundColor: colors.success },
  stepLine: {
    position: 'absolute', left: 12, top: 26, width: 2, height: 20,
    backgroundColor: colors.border,
  },
  stepLineDone: { backgroundColor: colors.success },
  stepLabel: { fontSize: fonts.sizes.sm, color: colors.textHint },
  stepLabelDone: { color: colors.textPrimary, fontWeight: '600' },
  infoBox: {
    flexDirection: 'row', gap: spacing.sm, backgroundColor: '#E3F2FD',
    padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.xl,
  },
  infoText: { flex: 1, fontSize: fonts.sizes.sm, color: colors.secondary, lineHeight: 20 },
});
