import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { AuthStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { authApi } from '../../api/auth.api';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'> };

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    // Validate starting digit (Indian mobile: 6-9)
    if (!/^[6-9]/.test(digits)) {
      setError('Please enter a valid Indian mobile number');
      return;
    }

    const fullPhone = `+91${digits}`;
    setError('');
    setLoading(true);

    try {
      await authApi.sendOtp(fullPhone);
      navigation.navigate('OTP', { phoneNumber: fullPhone });
    } catch (err: any) {
      const msg: string =
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        'Failed to send OTP. Please try again.';
      if (err?.response?.status === 429) {
        Alert.alert('Too Many Requests', 'You have requested too many OTPs. Please wait before trying again.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <StatusBar style="dark" />

        <View style={styles.topDecor} />

        <View style={styles.logoMini}>
          <View style={styles.dropMini}><Text style={styles.dropTxt}>+</Text></View>
        </View>

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Login to continue</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}>
              <Text style={styles.codeText}>+91 ▾</Text>
            </View>
            <View style={styles.phoneInput}>
              <Input
                value={phone}
                onChangeText={(text) => { setPhone(text); setError(''); }}
                placeholder="98765 43210"
                keyboardType="phone-pad"
                maxLength={10}
                error={error}
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            label="Send OTP"
            onPress={handleSendOTP}
            loading={loading}
            style={styles.btn}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>By continuing, you agree to our </Text>
          <TouchableOpacity>
            <Text style={styles.link}>Terms & Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.white, padding: spacing.xl, paddingTop: spacing.xxxl + 20 },
  topDecor: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 180,
    backgroundColor: colors.primaryPale, borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
  },
  logoMini: { alignSelf: 'center', marginBottom: spacing.xl },
  dropMini: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  dropTxt: { fontSize: 28, color: colors.white, fontWeight: '900' },
  title: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: fonts.sizes.base, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xxxl },
  form: { gap: spacing.sm },
  label: { fontSize: fonts.sizes.sm, color: colors.textSecondary, fontWeight: '500', marginBottom: spacing.xs },
  phoneRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  countryCode: {
    height: 50, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, justifyContent: 'center', backgroundColor: colors.grayPale,
  },
  codeText: { fontSize: fonts.sizes.base, color: colors.textPrimary, fontWeight: '600' },
  phoneInput: { flex: 1 },
  errorText: { fontSize: fonts.sizes.xs, color: colors.error, marginTop: -spacing.xs },
  btn: { marginTop: spacing.md },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.xxxl },
  footerText: { fontSize: fonts.sizes.sm, color: colors.textSecondary },
  link: { fontSize: fonts.sizes.sm, color: colors.primary, fontWeight: '600' },
});
