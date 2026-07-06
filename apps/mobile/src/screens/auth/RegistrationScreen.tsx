import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/types';
import { colors, fonts, spacing } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { SelectPicker } from '../../components/SelectPicker';
import { BLOOD_GROUPS, CITIES } from '../../utils/helpers';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Registration'>;
  route: RouteProp<AuthStackParamList, 'Registration'>;
};

export const RegistrationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phoneNumber } = route.params;
  const [fullName, setFullName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [city, setCity] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) e.fullName = 'Enter your full name';
    if (!bloodGroup) e.bloodGroup = 'Select your blood group';
    if (!city) e.city = 'Select your city';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigation.navigate('RoleSelection', { fullName: fullName.trim(), bloodGroup, city, phoneNumber });
    }, 800);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.sub}>Fill in your details</Text>

        <View style={styles.form}>
          <Input
            label="Full Name"
            value={fullName}
            onChangeText={t => { setFullName(t); setErrors(e => ({ ...e, fullName: '' })); }}
            placeholder="Rahul Sharma"
            autoCapitalize="words"
            error={errors.fullName}
          />

          <SelectPicker
            label="Blood Group"
            value={bloodGroup}
            options={BLOOD_GROUPS}
            placeholder="Select blood group"
            onSelect={v => { setBloodGroup(v); setErrors(e => ({ ...e, bloodGroup: '' })); }}
            error={errors.bloodGroup}
          />

          <SelectPicker
            label="City / Area"
            value={city}
            options={CITIES}
            placeholder="Select your city"
            onSelect={v => { setCity(v); setErrors(e => ({ ...e, city: '' })); }}
            error={errors.city}
          />

          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={18} color={colors.gray} />
            <Text style={styles.phoneText}>+91 {phoneNumber}</Text>
          </View>

          <Button label="Continue" onPress={handleContinue} loading={loading} style={styles.btn} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.white, padding: spacing.xl, paddingTop: spacing.xxxl },
  back: { marginBottom: spacing.xl },
  title: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: fonts.sizes.base, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  form: { gap: spacing.xs },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.grayPale, padding: spacing.md, borderRadius: 10, marginBottom: spacing.sm,
  },
  phoneText: { fontSize: fonts.sizes.base, color: colors.textSecondary },
  btn: { marginTop: spacing.md },
});
