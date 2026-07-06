import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { SelectPicker } from '../../components/SelectPicker';
import { useApp } from '../../context/AppContext';
import { BloodGroup, User } from '../../types';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'DonorProfileSetup'>;
  route: RouteProp<AuthStackParamList, 'DonorProfileSetup'>;
};

const GENDERS = ['Male', 'Female', 'Other'];

export const DonorProfileSetupScreen: React.FC<Props> = ({ navigation, route }) => {
  const { fullName, bloodGroup, city, phoneNumber } = route.params;
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [lastDonation, setLastDonation] = useState('');
  const [available, setAvailable] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { login } = useApp();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!dob) e.dob = 'Enter your date of birth';
    if (!gender) e.gender = 'Select your gender';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    setLoading(true);

    const user: User = {
      id: 'u1',
      fullName,
      phoneNumber,
      bloodGroup: bloodGroup as BloodGroup,
      city,
      role: 'donor',
      isVerified: false,
      dateOfBirth: dob,
      gender: gender as User['gender'],
      lastDonation: lastDonation || undefined,
      totalDonations: 0,
      availability: available,
    };

    setTimeout(() => {
      setLoading(false);
      login('donor', user);
    }, 800);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title}>Donor Profile</Text>
      <Text style={styles.sub}>Complete your profile</Text>

      <View style={styles.form}>
        <Input
          label="Date of Birth"
          value={dob}
          onChangeText={t => { setDob(t); setErrors(e => ({ ...e, dob: '' })); }}
          placeholder="DD MMM YYYY  e.g. 12 May 1995"
          rightIcon="calendar-outline"
          error={errors.dob}
        />

        <SelectPicker
          label="Gender"
          value={gender}
          options={GENDERS}
          placeholder="Select gender"
          onSelect={v => { setGender(v); setErrors(e => ({ ...e, gender: '' })); }}
          error={errors.gender}
        />

        <Input
          label="Last Donation Date (optional)"
          value={lastDonation}
          onChangeText={setLastDonation}
          placeholder="DD MMM YYYY  e.g. 10 Jan 2024"
          rightIcon="calendar-outline"
        />

        <View style={styles.availRow}>
          <View style={styles.availInfo}>
            <Text style={styles.availTitle}>Availability</Text>
            <Text style={styles.availSub}>I am available to donate</Text>
          </View>
          <Switch
            value={available}
            onValueChange={setAvailable}
            thumbColor={available ? colors.white : colors.grayLight}
            trackColor={{ false: colors.grayLight, true: colors.primary }}
          />
        </View>

        <View style={styles.info}>
          <Ionicons name="information-circle-outline" size={16} color={colors.secondary} />
          <Text style={styles.infoText}>
            Your profile will be verified within 24 hours. You can start donating after verification.
          </Text>
        </View>

        <Button label="Save & Continue" onPress={handleSave} loading={loading} style={styles.btn} />
      </View>
    </ScrollView>
  );
};

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
