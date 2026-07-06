import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';

import { ReceiverDashboardScreen } from '../screens/receiver/ReceiverDashboardScreen';
import { CreateRequestScreen } from '../screens/receiver/CreateRequestScreen';
import { RequestSubmittedScreen } from '../screens/receiver/RequestSubmittedScreen';
import { MatchingDonorsScreen } from '../screens/receiver/MatchingDonorsScreen';
import { RequestStatusScreen } from '../screens/receiver/RequestStatusScreen';
import { ReceiverProfileScreen } from '../screens/receiver/ReceiverProfileScreen';
import { NotificationsScreen } from '../screens/common/NotificationsScreen';
import { ReportUserScreen } from '../screens/common/ReportUserScreen';
import { ReceiverHomeStackParamList, ReceiverProfileStackParamList } from './types';

const HomeStack = createNativeStackNavigator<ReceiverHomeStackParamList>();
const ProfileStack = createNativeStackNavigator<ReceiverProfileStackParamList>();
const Tab = createBottomTabNavigator();

const HomeNavigator = () => (
  <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <HomeStack.Screen name="ReceiverDashboard" component={ReceiverDashboardScreen} />
    <HomeStack.Screen name="CreateRequest" component={CreateRequestScreen} />
    <HomeStack.Screen name="RequestSubmitted" component={RequestSubmittedScreen} />
    <HomeStack.Screen name="MatchingDonors" component={MatchingDonorsScreen} />
    <HomeStack.Screen name="RequestStatus" component={RequestStatusScreen} />
    <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
    <HomeStack.Screen name="ReportUser" component={ReportUserScreen} />
  </HomeStack.Navigator>
);

const ProfileNavigator = () => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <ProfileStack.Screen name="ReceiverProfile" component={ReceiverProfileScreen} />
    <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
    <ProfileStack.Screen name="ReportUser" component={ReportUserScreen} />
  </ProfileStack.Navigator>
);

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcon = (route: string, focused: boolean): IconName => {
  const icons: Record<string, [IconName, IconName]> = {
    Home:          ['home', 'home-outline'],
    MyRequests:    ['document-text', 'document-text-outline'],
    Notifications: ['notifications', 'notifications-outline'],
    Profile:       ['person', 'person-outline'],
  };
  const pair = icons[route];
  return pair ? (focused ? pair[0] : pair[1]) : 'ellipse';
};

export const ReceiverNavigator = () => (
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
    <Tab.Screen name="MyRequests" component={RequestStatusScreen} options={{ title: 'My Requests', unmountOnBlur: false }} />
    <Tab.Screen name="Notifications" component={NotificationsScreen} />
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
