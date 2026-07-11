import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius } from '../../theme';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { SelectPicker } from '../../components/SelectPicker';
import { donorsApi } from '../../api/donors.api';
import { useAuthStore, StoredUser } from '../../store/auth.store';
import { getDeviceCoords } from '../../utils/location';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'DonorProfileSetup'>;
  route: RouteProp<AuthStackParamList, 'DonorProfileSetup'>;
};

const GENDERS = ['Male', 'Female', 'Other'];
const GENDER_MAP: Record<string, 'MALE' | 'FEMALE' | 'OTHER'> = {
  Male: 'MALE', Female: 'FEMALE', Other: 'OTHER',
};

export const DonorProfileSetupScreen: React.FC<Props> = ({ navigation }) => {
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [lastDonation, setLastDonation] = useState('');
  const [available, setAvailable] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const { registrationTokens, setAuth } = useAuthStore();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!dob) e.dob = 'Enter your date of birth';
    if (!gender) e.gender = 'Select your gender';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const dateOfBirth = parseDob(dob);
    if (!dateOfBirth) {
      setErrors((e) => ({ ...e, dob: 'Invalid date. Use DD/MM/YYYY' }));
      return;
    }
    let lastDonationDate: string | null = null;
    if (lastDonation.trim()) {
      lastDonationDate = parseDob(lastDonation);
      if (!lastDonationDate) {
        setErrors((e) => ({ ...e, lastDonation: 'Invalid date. Use DD/MM/YYYY' }));
        return;
      }
    }

    if (!registrationTokens) {
      Alert.alert('Session Expired', 'Please start registration again.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }

    setLoading(true);
    try {
      // Get GPS location (optional — gracefully skipped if denied or no fix)
      const coords = await getDeviceCoords();

      const payload: any = {
        isAvailable: available,
        gender: GENDER_MAP[gender],
        dateOfBirth,
      };
      if (lastDonationDate) payload.lastDonationDate = lastDonationDate;
      if (coords) {
        payload.locationLat = coords.lat;
        payload.locationLng = coords.lng;
      }

      await donorsApi.createProfileWithToken(payload, registrationTokens.accessToken);

      // Now fully authenticate — RootNavigator switches to DonorNavigator
      await setAuth(
        registrationTokens.user as StoredUser,
        registrationTokens.accessToken,
        registrationTokens.refreshToken,
      );
    } catch (err: any) {
      const msg: string =
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        'Failed to save profile. Please try again.';
      Alert.alert('Setup Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title}>Donor Profile</Text>
      <Text style={styles.sub}>Complete your profile to start donating</Text>

      <View style={styles.form}>
        <DateInput
          label="Date of Birth"
          value={dob}
          onChangeText={(t) => { setDob(t); setErrors((e) => ({ ...e, dob: '' })); }}
          placeholder="DD/MM/YYYY  e.g. 12/05/1995"
          maximumDate={new Date()}
          error={errors.dob}
        />

        <SelectPicker
          label="Gender"
          value={gender}
          options={GENDERS}
          placeholder="Select gender"
          onSelect={(v) => { setGender(v); setErrors((e) => ({ ...e, gender: '' })); }}
          error={errors.gender}
        />

        <DateInput
          label="Last Donation Date (optional)"
          value={lastDonation}
          onChangeText={(t) => { setLastDonation(t); setErrors((e) => ({ ...e, lastDonation: '' })); }}
          placeholder="DD/MM/YYYY  e.g. 10/01/2024"
          maximumDate={new Date()}
          error={errors.lastDonation}
        />

        <View style={styles.availRow}>
          <View style={styles.availInfo}>
            <Text style={styles.availTitle}>Available to Donate</Text>
            <Text style={styles.availSub}>Toggle off if currently unavailable</Text>
          </View>
          <Switch
            value={available}
            onValueChange={setAvailable}
            thumbColor={available ? colors.white : colors.grayLight}
            trackColor={{ false: colors.grayLight, true: colors.primary }}
          />
        </View>

        <View style={styles.info}>
          <Ionicons name="location-outline" size={16} color={colors.secondary} />
          <Text style={styles.infoText}>
            We'll request your location to show you nearby blood requests.
          </Text>
        </View>

        <View style={styles.info}>
          <Ionicons name="information-circle-outline" size={16} color={colors.secondary} />
          <Text style={styles.infoText}>
            Profile under review. You can donate once verified (typically within 24 hours).
          </Text>
        </View>

        <Button label="Save & Continue" onPress={handleSave} loading={loading} style={styles.btn} />
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Parse "DD/MM/YYYY" or "DD MMM YYYY" into ISO date string; null if not a real date
function parseDob(raw: string): string | null {
  const trimmed = raw.trim();
  // DD/MM/YYYY
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const parsed = new Date(`${iso}T00:00:00`);
    // Reject calendar rollovers like 31/02/2000 → Mar 2
    if (
      isNaN(parsed.getTime()) ||
      parsed.getDate() !== parseInt(d, 10) ||
      parsed.getMonth() + 1 !== parseInt(m, 10)
    ) {
      return null;
    }
    return iso;
  }
  // Try native Date parse as fallback
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.white, padding: spacing.xl, paddingTop: spacing.xxxl },
  back: { marginBottom: spacing.xl },
  title: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: fonts.sizes.base, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  form: { gap: spacing.xs },
  availRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.grayPale, padding: spacing.base, borderRadius: radius.md, marginVertical: spacing.xs,
  },
  availInfo: { flex: 1 },
  availTitle: { fontSize: fonts.sizes.base, fontWeight: '600', color: colors.textPrimary },
  availSub: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  info: {
    flexDirection: 'row', gap: spacing.xs, backgroundColor: '#E3F2FD',
    padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: fonts.sizes.sm, color: colors.secondary, lineHeight: 20 },
  btn: { marginTop: spacing.md },
});
