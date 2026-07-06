import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OTPScreen } from '../screens/auth/OTPScreen';
import { RegistrationScreen } from '../screens/auth/RegistrationScreen';
import { RoleSelectionScreen } from '../screens/auth/RoleSelectionScreen';
import { DonorProfileSetupScreen } from '../screens/donor/DonorProfileSetupScreen';
import { VerificationPendingScreen } from '../screens/common/VerificationPendingScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="OTP" component={OTPScreen} />
    <Stack.Screen name="Registration" component={RegistrationScreen} />
    <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
    <Stack.Screen name="DonorProfileSetup" component={DonorProfileSetupScreen} />
    <Stack.Screen name="VerificationPending" component={VerificationPendingScreen} />
  </Stack.Navigator>
);
