import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';

import { DonorDashboardScreen } from '../screens/donor/DonorDashboardScreen';
import { NearbyRequestsScreen } from '../screens/donor/NearbyRequestsScreen';
import { RequestDetailsScreen } from '../screens/donor/RequestDetailsScreen';
import { DonationHistoryScreen } from '../screens/donor/DonationHistoryScreen';
import { DonorProfileScreen } from '../screens/donor/DonorProfileScreen';
import { NotificationsScreen } from '../screens/common/NotificationsScreen';
import { ReportUserScreen } from '../screens/common/ReportUserScreen';
import { VerificationPendingScreen } from '../screens/common/VerificationPendingScreen';
import {
  DonorHomeStackParamList,
  DonorHistoryStackParamList,
  DonorProfileStackParamList,
} from './types';

const HomeStack = createNativeStackNavigator<DonorHomeStackParamList>();
const RequestsStack = createNativeStackNavigator<DonorHomeStackParamList>();
const HistoryStack = createNativeStackNavigator<DonorHistoryStackParamList>();
const ProfileStack = createNativeStackNavigator<DonorProfileStackParamList>();
const Tab = createBottomTabNavigator();

const HomeNavigator = () => (
  <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <HomeStack.Screen name="DonorDashboard" component={DonorDashboardScreen} />
    <HomeStack.Screen name="NearbyRequests" component={NearbyRequestsScreen} />
    <HomeStack.Screen name="RequestDetails" component={RequestDetailsScreen} />
    <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
    <HomeStack.Screen name="ReportUser" component={ReportUserScreen} />
    <HomeStack.Screen name="VerificationPendingDonor" component={VerificationPendingScreen} />
  </HomeStack.Navigator>
);

const RequestsNavigator = () => (
  <RequestsStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <RequestsStack.Screen name="NearbyRequests" component={NearbyRequestsScreen} />
    <RequestsStack.Screen name="RequestDetails" component={RequestDetailsScreen} />
    <RequestsStack.Screen name="ReportUser" component={ReportUserScreen} />
    <RequestsStack.Screen name="Notifications" component={NotificationsScreen} />
    <RequestsStack.Screen name="VerificationPendingDonor" component={VerificationPendingScreen} />
    <RequestsStack.Screen name="DonorDashboard" component={DonorDashboardScreen} />
  </RequestsStack.Navigator>
);

const HistoryNavigator = () => (
  <HistoryStack.Navigator screenOptions={{ headerShown: false }}>
    <HistoryStack.Screen name="DonationHistory" component={DonationHistoryScreen} />
  </HistoryStack.Navigator>
);

const ProfileNavigator = () => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <ProfileStack.Screen name="DonorProfile" component={DonorProfileScreen} />
    <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
    <ProfileStack.Screen name="ReportUser" component={ReportUserScreen} />
    <ProfileStack.Screen name="VerificationPendingDonor" component={VerificationPendingScreen} />
  </ProfileStack.Navigator>
);

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcon = (route: string, focused: boolean): IconName => {
  const icons: Record<string, [IconName, IconName]> = {
    Home:     ['home', 'home-outline'],
    Requests: ['document-text', 'document-text-outline'],
    History:  ['time', 'time-outline'],
    Profile:  ['person', 'person-outline'],
  };
  const pair = icons[route];
  return pair ? (focused ? pair[0] : pair[1]) : 'ellipse';
};

export const DonorNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ focused, color, size }) => (
        <Ionicons name={tabIcon(route.name, focused)} size={size} color={color} />
      ),
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.gray,
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabLabel,
    })}
  >
    <Tab.Screen name="Home" component={HomeNavigator} />
    <Tab.Screen name="Requests" component={RequestsNavigator} />
    <Tab.Screen name="History" component={HistoryNavigator} />
    <Tab.Screen name="Profile" component={ProfileNavigator} />
  </Tab.Navigator>
);

const styles = StyleSheet.create({
  tabBar: {
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  tabLabel: { fontSize: fonts.sizes.xs, fontWeight: '600' },
});
