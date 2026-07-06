import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ReceiverHomeStackParamList } from '../../navigation/types';
import { colors, fonts, spacing, radius, shadow } from '../../theme';
import { Button } from '../../components/Button';

type Props = {
  navigation: NativeStackNavigationProp<ReceiverHomeStackParamList, 'RequestSubmitted'>;
  route: RouteProp<ReceiverHomeStackParamList, 'RequestSubmitted'>;
};

export const RequestSubmittedScreen: React.FC<Props> = ({ navigation, route }) => {
  const { requestId } = route.params;
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 5 }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.successWrap, { transform: [{ scale }] }]}>
        <View style={styles.circle}>
          <Ionicons name="checkmark" size={56} color={colors.white} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.content, { opacity }]}>
        <Text style={styles.title}>Request Submitted{'\n'}Successfully!</Text>

        <View style={styles.idCard}>
          <Text style={styles.idLabel}>Request ID</Text>
          <Text style={styles.idValue}>{requestId}</Text>
        </View>

        <Text style={styles.message}>
          We will notify you when donors are available. You can track the status of your request.
        </Text>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="notifications-outline" size={24} color={colors.primary} />
            <Text style={styles.infoText}>Real-time{'\n'}Alerts</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoItem}>
            <Ionicons name="people-outline" size={24} color={colors.primary} />
            <Text style={styles.infoText}>Nearby{'\n'}Donors</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={24} color={colors.primary} />
            <Text style={styles.infoText}>{'<'}5 min{'\n'}Response</Text>
          </View>
        </View>

        <Button
          label="View My Requests"
          onPress={() => navigation.navigate('RequestStatus', { requestId })}
          style={styles.btn}
        />
        <Button
          label="Create Another Request"
          onPress={() => navigation.navigate('CreateRequest')}
          variant="outline"
          style={styles.btn2}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  successWrap: { marginBottom: spacing.xl },
  circle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center',
    ...shadow.lg,
  },
  content: { width: '100%', alignItems: 'center' },
  title: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', lineHeight: 34 },
  idCard: {
    backgroundColor: colors.primaryPale, borderRadius: radius.lg, paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl, alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.primaryLight,
  },
  idLabel: { fontSize: fonts.sizes.xs, color: colors.textSecondary },
  idValue: { fontSize: fonts.sizes.lg, fontWeight: '800', color: colors.primary, letterSpacing: 1 },
  message: {
    fontSize: fonts.sizes.sm, color: colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row', width: '100%', backgroundColor: colors.grayPale,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.xl,
  },
  infoItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  infoText: { fontSize: fonts.sizes.xs, color: colors.textSecondary, textAlign: 'center', lineHeight: 16 },
  divider: { width: 1, backgroundColor: colors.border },
  btn: {},
  btn2: { marginTop: spacing.sm },
});
