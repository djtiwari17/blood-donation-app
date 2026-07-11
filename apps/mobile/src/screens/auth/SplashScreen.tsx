import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { AuthStackParamList } from '../../navigation/types';
import { colors, fonts, spacing } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Splash'> };

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => navigation.replace('Login'), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Animated.View style={[styles.logoWrap, { transform: [{ scale }], opacity }]}>
        <View style={styles.dropOuter}>
          <View style={styles.dropInner}>
            <Text style={styles.dropText}>+</Text>
          </View>
        </View>
        <View style={styles.pulse} />
      </Animated.View>
      <Animated.View style={{ opacity }}>
        <Text style={styles.appName}>Blood Donation</Text>
        <Text style={styles.tagline}>Save Life, Be a Hero</Text>
      </Animated.View>
      <View style={styles.dots}>
        {[0, 1, 2].map(i => <View key={i} style={[styles.dot, i === 1 && styles.dotActive]} />)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  logoWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  dropOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropText: { fontSize: 40, color: colors.primary, fontWeight: '900', lineHeight: 46 },
  pulse: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  appName: {
    fontSize: fonts.sizes.xxxl,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: fonts.sizes.base,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: spacing.xs,
    letterSpacing: 0.3,
  },
  dots: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: colors.white, width: 20 },
});
