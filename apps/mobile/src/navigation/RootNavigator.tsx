import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { useAuthStore } from '../store/auth.store';
import { usersApi } from '../api/users.api';
import { AuthNavigator } from './AuthNavigator';
import { DonorNavigator } from './DonorNavigator';
import { ReceiverNavigator } from './ReceiverNavigator';
import { colors } from '../theme';

export const RootNavigator = () => {
  const { isAuthenticated, isLoading, user, loadTokens, setAuth, logout } = useAuthStore();

  // On app start: check if tokens exist and fetch user profile
  useEffect(() => {
    (async () => {
      const hasTokens = await loadTokens();
      if (hasTokens && !user) {
        try {
          const { data: envelope } = await usersApi.getMe();
          const fetchedUser = envelope.data;
          // Re-use existing tokens (already in SecureStore) — just update user in store
          useAuthStore.setState({ user: fetchedUser });
        } catch {
          // Token invalid or network error — log out
          await logout();
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const role = user?.role ?? '';

  return (
    <NavigationContainer ref={navigationRef}>
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : role === 'DONOR' || role === 'DONOR_RECEIVER' ? (
        <DonorNavigator />
      ) : (
        <ReceiverNavigator />
      )}
    </NavigationContainer>
  );
};
