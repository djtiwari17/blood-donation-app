import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Button } from '../../components/Button';
import { authApi, ExistingUserResult, NewUserResult } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OTP'>;
  route: RouteProp<AuthStackParamList, 'OTP'>;
};

const OTP_LEN = 6;
const RESEND_COUNTDOWN = 45;

export const OTPScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phoneNumber } = route.params;
  const [otp, setOtp] = useState<string[]>(Array(OTP_LEN).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const inputs = useRef<(TextInput | null)[]>([]);

  const { setAuth, setOtpSession } = useAuthStore();

  useEffect(() => {
    if (countdown === 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleChange = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    setError('');
    if (digit && idx < OTP_LEN - 1) inputs.current[idx + 1]?.focus();
    if (!digit && idx > 0) inputs.current[idx - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LEN) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: envelope } = await authApi.verifyOtp(phoneNumber, code);
      const result = envelope.data;

      if (result.isNewUser) {
        // New user: save otpSession in store and navigate to Registration
        const newUser = result as NewUserResult;
        setOtpSession(newUser.otpSession);
        navigation.navigate('Registration', { phoneNumber });
      } else {
        // Existing user: save tokens and navigate to app
        const existing = result as ExistingUserResult;
        await setAuth(
          existing.user as Record<string, unknown>,
          existing.accessToken,
          existing.refreshToken,
        );
        // RootNavigator will detect isAuthenticated and redirect automatically
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg: string =
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        'Verification failed. Please try again.';

      if (status === 429) {
        Alert.alert(
          'Account Locked',
          'Too many failed attempts. Please wait 30 minutes before trying again.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setCountdown(RESEND_COUNTDOWN);
    setOtp(Array(OTP_LEN).fill(''));
    setError('');
    inputs.current[0]?.focus();

    try {
      await authApi.sendOtp(phoneNumber);
    } catch (err: any) {
      const msg: string =
        err?.response?.status === 429
          ? 'Too many OTP requests. Please wait.'
          : 'Failed to resend OTP.';
      Alert.alert('Resend Failed', msg);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Ionicons name="phone-portrait-outline" size={48} color={colors.primary} />
        </View>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.sub}>Enter the 6-digit code sent to</Text>
        <Text style={styles.phone}>{phoneNumber}</Text>

        <View style={styles.otpRow}>
          {otp.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputs.current[i] = r; }}
              style={[styles.otpBox, d ? styles.otpFilled : null, error ? styles.otpError : null]}
              value={d}
              onChangeText={(t) => handleChange(t, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectionColor={colors.primary}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !d && i > 0) {
                  inputs.current[i - 1]?.focus();
                }
              }}
            />
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Verify" onPress={handleVerify} loading={loading} style={styles.btn} />

        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.resendText}>
              Resend OTP in{' '}
              <Text style={styles.timer}>00:{countdown.toString().padStart(2, '0')}</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendLink}>Resend OTP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const BOX = 48;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: spacing.xl, paddingTop: spacing.xxxl },
  back: { marginBottom: spacing.xl },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: spacing.lg,
  },
  title: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  sub: { fontSize: fonts.sizes.base, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  phone: { fontSize: fonts.sizes.base, color: colors.primary, fontWeight: '700', textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  otpBox: {
    width: BOX, height: BOX + 8, borderWidth: 2, borderColor: colors.border,
    borderRadius: radius.md, fontSize: fonts.sizes.xl, fontWeight: '700',
    color: colors.textPrimary, backgroundColor: colors.grayPale,
    ...shadow.sm,
  },
  otpFilled: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
  otpError: { borderColor: colors.error },
  error: { fontSize: fonts.sizes.sm, color: colors.error, textAlign: 'center', marginBottom: spacing.md },
  btn: { marginTop: spacing.xs },
  resendRow: { alignItems: 'center', marginTop: spacing.lg },
  resendText: { fontSize: fonts.sizes.sm, color: colors.textSecondary },
  timer: { color: colors.primary, fontWeight: '700' },
  resendLink: { fontSize: fonts.sizes.sm, color: colors.primary, fontWeight: '700' },
});
