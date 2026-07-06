import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { AuthStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { SelectPicker } from '../../components/SelectPicker';
import { donorsApi } from '../../api/donors.api';
import { useAuthStore, StoredUser } from '../../store/auth.store';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'DonorProfileSetup'>;
  route: RouteProp<AuthStackParamList, 'DonorProfileSetup'>;
};

const GENDERS = ['Male', 'Female', 'Other'];
const GENDER_MAP: Record<string, 'MALE' | 'FEMALE' | 'OTHER'> = {
  Male: 'MALE', Female: 'FEMALE', Other: 'OTHER',
};

async function requestLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    return null;
  }
}

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
    if (!registrationTokens) {
      Alert.alert('Session Expired', 'Please start registration again.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }

    setLoading(true);
    try {
      // Get GPS location (optional — gracefully skipped if denied)
      const coords = await requestLocation();

      const payload: any = {
        isAvailable: available,
        gender: GENDER_MAP[gender],
        dateOfBirth: parseDob(dob),
      };
      if (lastDonation) payload.lastDonationDate = parseDob(lastDonation);
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title}>Donor Profile</Text>
      <Text style={styles.sub}>Complete your profile to start donating</Text>

      <View style={styles.form}>
        <Input
          label="Date of Birth"
          value={dob}
          onChangeText={(t) => { setDob(t); setErrors((e) => ({ ...e, dob: '' })); }}
          placeholder="DD/MM/YYYY  e.g. 12/05/1995"
          rightIcon="calendar-outline"
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

        <Input
          label="Last Donation Date (optional)"
          value={lastDonation}
          onChangeText={setLastDonation}
          placeholder="DD/MM/YYYY  e.g. 10/01/2024"
          rightIcon="calendar-outline"
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
  );
};

// Parse "DD/MM/YYYY" or "DD MMM YYYY" into ISO date string
function parseDob(raw: string): string {
  const trimmed = raw.trim();
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m}-${d}`;
  }
  // Try native Date parse as fallback
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? trimmed : parsed.toISOString().split('T')[0];
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
