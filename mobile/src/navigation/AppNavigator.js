import React, { useRef, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useMessageBadge } from '../context/MessageBadgeContext';
import FormIcon from '../components/FormIcon';

import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import HomeScreen from '../screens/HomeScreen';
import ReportLostScreen from '../screens/ReportLostScreen';
import ReportFoundScreen from '../screens/ReportFoundScreen';
import ScanQRScreen from '../screens/ScanQRScreen';
import MyClaimsScreen from '../screens/MyClaimsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AIMatchesScreen from '../screens/AIMatchesScreen';
import VerificationScreen from '../screens/VerificationScreen';
import HandoverScreen from '../screens/HandoverScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import TimelineScreen from '../screens/TimelineScreen';
import AccessibilityScreen from '../screens/AccessibilityScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ label, focused, badgeCount }) {
  const { themeColors } = useAccessibility();
  const icons = { Home: 'home', Claims: 'clipboard', Messages: 'message-square' };
  return (
    <View style={tabStyles.iconContainer}>
      <FormIcon name={icons[label] || 'map-pin'} size={20} color={focused ? themeColors.accent : themeColors.muted} />
      {typeof badgeCount === 'number' && badgeCount > 0 && (
        <View style={tabStyles.badge}>
          <Text style={tabStyles.badgeText}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
}

function MainTabs() {
  const { unreadCount } = useMessageBadge();
  const { themeColors, announceNavigation } = useAccessibility();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenListeners={({ route }) => ({ tabPress: () => announceNavigation(screenNames[route.name] || route.name) })}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              label={route.name}
              focused={focused}
              badgeCount={route.name === 'Messages' ? unreadCount : undefined}
            />
          ),
          tabBarActiveTintColor: themeColors.accent,
          tabBarInactiveTintColor: themeColors.muted,
          tabBarStyle: {
            position: 'absolute',
            bottom: 16,
            left: 18,
            right: 18,
            backgroundColor: themeColors.tab,
            borderRadius: 28,
            height: 68,
            paddingTop: 6,
            paddingBottom: 8,
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: themeColors.border,
            shadowColor: '#4f46e5',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.20,
            shadowRadius: 16,
            elevation: 16,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            marginTop: 2,
            letterSpacing: 0.3,
          },
          tabBarItemStyle: {
            paddingVertical: 2,
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Claims" component={MyClaimsScreen} options={{ tabBarLabel: 'Claims' }} />
        <Tab.Screen
          name="Messages"
          component={MessagesScreen}
        />
      </Tab.Navigator>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 38,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});

// Friendly screen names for TTS announcements (just says where you are)
const screenNames = {
  Main: 'Home',
  Home: 'Home',
  Claims: 'My Reports',
  Messages: 'Messages',
  Login: 'Sign In',
  SignUp: 'Create Account',
  ReportLost: 'Report Lost Item',
  ReportFound: 'Report Found Item',
  Profile: 'Profile',
  AIMatches: 'AI Matches',
  Verification: 'Verification',
  Handover: 'Schedule Pickup',
  Settings: 'Settings',
  Notifications: 'Notifications',
  Feedback: 'Feedback',
  Timeline: 'Activity Timeline',
  Accessibility: 'Accessibility',
  ScanQR: 'Scan QR Code',
};

const stackScreenOptions = (colors) => ({
  headerTintColor: colors.accent,
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '700', fontSize: 17, letterSpacing: 0.2 },
});

export default function AppNavigator() {
  const { isAuthenticated } = useAuth();
  const { announceNavigation, ttsEnabled, activeTheme, themeColors } = useAccessibility();
  const baseNavTheme = activeTheme === 'light' ? DefaultTheme : DarkTheme;
  const navigationTheme = {
    ...baseNavTheme,
    colors: { ...baseNavTheme.colors, primary: themeColors.accent, background: themeColors.background, card: themeColors.surface, text: themeColors.text, border: themeColors.border },
  };
  const prevRouteRef = useRef(null);

  const getActiveRouteName = (state) => {
    if (!state) return null;
    const route = state.routes[state.index];
    // Dive into nested navigators
    if (route.state) {
      return getActiveRouteName(route.state);
    }
    return route.name;
  };

  return (
    <NavigationContainer
      theme={navigationTheme}
      onStateChange={(state) => {
        if (!ttsEnabled) return;
        const currentRouteName = getActiveRouteName(state);
        if (currentRouteName && currentRouteName !== prevRouteRef.current) {
          prevRouteRef.current = currentRouteName;
          const friendlyName = screenNames[currentRouteName] || currentRouteName;
          announceNavigation(friendlyName);
        }
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="ReportLost" component={ReportLostScreen} options={{ headerShown: true, title: 'Report Lost', ...stackScreenOptions(themeColors) }} />
            <Stack.Screen name="ReportFound" component={ReportFoundScreen} options={{ headerShown: true, title: 'Report Found', ...stackScreenOptions(themeColors) }} />
            <Stack.Screen name="ScanQR" component={ScanQRScreen} options={{ headerShown: true, title: 'Scan QR', ...stackScreenOptions(themeColors) }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, title: 'Profile', ...stackScreenOptions(themeColors) }} />
            <Stack.Screen name="AIMatches" component={AIMatchesScreen} options={{ headerShown: true, title: 'AI Matches', ...stackScreenOptions(themeColors) }} />
            <Stack.Screen name="Verification" component={VerificationScreen} options={{ headerShown: true, title: 'Verify Ownership', ...stackScreenOptions(themeColors) }} />
            <Stack.Screen name="Handover" component={HandoverScreen} options={{ headerShown: true, title: 'Pickup', ...stackScreenOptions(themeColors) }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings', ...stackScreenOptions(themeColors) }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true, title: 'Notifications', ...stackScreenOptions(themeColors) }} />
            <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ headerShown: true, title: 'Feedback', ...stackScreenOptions(themeColors) }} />
            <Stack.Screen name="Timeline" component={TimelineScreen} options={{ headerShown: true, title: 'Activity', ...stackScreenOptions(themeColors) }} />
            <Stack.Screen name="Accessibility" component={AccessibilityScreen} options={{ headerShown: true, title: 'Accessibility', ...stackScreenOptions(themeColors) }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
