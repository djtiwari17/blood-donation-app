import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Button } from '../../components/Button';
import { authApi } from '../../api/auth.api';
import { useAuthStore, StoredUser } from '../../store/auth.store';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'RoleSelection'>;
  route: RouteProp<AuthStackParamList, 'RoleSelection'>;
};

export const RoleSelectionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { fullName, bloodGroup, city, phoneNumber } = route.params;
  const [selected, setSelected] = useState<'DONOR' | 'RECEIVER' | null>(null);
  const [loading, setLoading] = useState(false);

  const { otpSession, setAuth, setRegistrationTokens, clearOtpSession } = useAuthStore();

  const handleContinue = async () => {
    if (!selected || !otpSession) return;

    setLoading(true);
    try {
      const { data: envelope } = await authApi.register({
        otpSession,
        name: fullName,
        bloodGroup: bloodGroup as any,
        city,
        role: selected,
      });

      clearOtpSession();
      const { accessToken, refreshToken, user } = envelope.data;

      if (selected === 'DONOR') {
        // Hold tokens until donor profile is complete
        setRegistrationTokens({ accessToken, refreshToken, user: user as StoredUser });
        navigation.navigate('DonorProfileSetup', { fullName, bloodGroup, city, phoneNumber });
      } else {
        // Receiver: go straight into the app
        await setAuth(user as StoredUser, accessToken, refreshToken);
      }
    } catch (err: any) {
      const msg: string =
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        'Registration failed. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title}>I want to</Text>
      <Text style={styles.sub}>Choose your role to continue</Text>

      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, selected === 'DONOR' && styles.cardSelected]}
          onPress={() => setSelected('DONOR')}
          activeOpacity={0.85}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryPale }]}>
            <Ionicons name="heart" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, selected === 'DONOR' && styles.cardTitleSelected]}>
            I am a Donor
          </Text>
          <Text style={styles.cardSub}>I want to donate blood</Text>
          {selected === 'DONOR' && (
            <View style={styles.checkMark}>
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, selected === 'RECEIVER' && styles.cardSelected]}
          onPress={() => setSelected('RECEIVER')}
          activeOpacity={0.85}
        >
          <View style={[styles.iconWrap, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="person" size={40} color={colors.secondary} />
          </View>
          <Text style={[styles.cardTitle, selected === 'RECEIVER' && styles.cardTitleSelected]}>
            I am a Receiver
          </Text>
          <Text style={styles.cardSub}>I need blood</Text>
          {selected === 'RECEIVER' && (
            <View style={styles.checkMark}>
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Button
        label="Continue"
        onPress={handleContinue}
        loading={loading}
        disabled={!selected}
        style={styles.btn}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.white, padding: spacing.xl, paddingTop: spacing.xxxl },
  back: { marginBottom: spacing.xl },
  title: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: fonts.sizes.base, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  cards: { gap: spacing.base, marginBottom: spacing.xl },
  card: {
    padding: spacing.xl, borderRadius: radius.xl, borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.white, alignItems: 'center', position: 'relative', ...shadow.sm,
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: '#FFF8F8' },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.textPrimary },
  cardTitleSelected: { color: colors.primary },
  cardSub: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
  checkMark: { position: 'absolute', top: spacing.md, right: spacing.md },
  btn: { marginTop: spacing.sm },
});
