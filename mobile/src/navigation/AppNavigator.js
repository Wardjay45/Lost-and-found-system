import React, { useRef, useEffect } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useMessageBadge } from '../context/MessageBadgeContext';

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
  const icons = { Home: '🏠', Scan: '📷', Claims: '📋', Messages: '💬' };
  const isScan = label === 'Scan';
  return (
    <View style={[tabStyles.iconContainer, isScan && tabStyles.scanIconWrapper]}>
      {isScan ? (
        <View style={[tabStyles.scanCircle, focused && tabStyles.scanCircleActive]}>
          <Text style={{ fontSize: 20 }}>{icons[label]}</Text>
        </View>
      ) : (
        <>
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
            {icons[label] || '📍'}
          </Text>
          {typeof badgeCount === 'number' && badgeCount > 0 && (
            <View style={tabStyles.badge}>
              <Text style={tabStyles.badgeText}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function MainTabs({ navigation }) {
  const { unreadCount, markSeen } = useMessageBadge();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              label={route.name}
              focused={focused}
              badgeCount={route.name === 'Messages' ? unreadCount : undefined}
            />
          ),
          tabBarActiveTintColor: '#a5b4fc',
          tabBarInactiveTintColor: '#64748b',
          tabBarStyle: {
            position: 'absolute',
            bottom: 16,
            left: 18,
            right: 18,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderRadius: 28,
            height: 68,
            paddingTop: 6,
            paddingBottom: 8,
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: 'rgba(129, 140, 248, 0.10)',
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
        <Tab.Screen name="Scan" component={ScanQRScreen} options={{ tabBarLabel: 'Scan' }} />
        <Tab.Screen name="Claims" component={MyClaimsScreen} options={{ tabBarLabel: 'Claims' }} />
        <Tab.Screen
          name="Messages"
          component={MessagesScreen}
          listeners={{
            tabPress: () => {
              markSeen();
            },
          }}
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
  scanIconWrapper: {
    marginTop: -10,
  },
  scanCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(15, 23, 42, 0.95)',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.40,
    shadowRadius: 8,
    elevation: 8,
  },
  scanCircleActive: {
    backgroundColor: '#6366f1',
    shadowOpacity: 0.55,
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
  Scan: 'Scan QR Code',
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

const stackScreenOptions = {
  headerTintColor: '#a5b4fc',
  headerStyle: { backgroundColor: '#0f172a' },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '700', fontSize: 17, letterSpacing: 0.2 },
};

export default function AppNavigator() {
  const { isAuthenticated } = useAuth();
  const { announceNavigation, ttsEnabled } = useAccessibility();
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
      onStateChange={(state) => {
        if (!ttsEnabled) return;
        const currentRouteName = getActiveRouteName(state);
        if (currentRouteName && currentRouteName !== prevRouteRef.current) {
          prevRouteRef.current = currentRouteName;
          const friendlyName = screenNames[currentRouteName] || currentRouteName;
          setTimeout(() => {
            announceNavigation(friendlyName);
          }, 400);
        }
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ReportLost" component={ReportLostScreen} options={{ headerShown: true, title: 'Report Lost', ...stackScreenOptions }} />
            <Stack.Screen name="ReportFound" component={ReportFoundScreen} options={{ headerShown: true, title: 'Report Found', ...stackScreenOptions }} />
            <Stack.Screen name="ScanQR" component={ScanQRScreen} options={{ headerShown: true, title: 'Scan QR', ...stackScreenOptions }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, title: 'Profile', ...stackScreenOptions }} />
            <Stack.Screen name="AIMatches" component={AIMatchesScreen} options={{ headerShown: true, title: 'AI Matches', ...stackScreenOptions }} />
            <Stack.Screen name="Verification" component={VerificationScreen} options={{ headerShown: true, title: 'Verify Ownership', ...stackScreenOptions }} />
            <Stack.Screen name="Handover" component={HandoverScreen} options={{ headerShown: true, title: 'Pickup', ...stackScreenOptions }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings', ...stackScreenOptions }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true, title: 'Notifications', ...stackScreenOptions }} />
            <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ headerShown: true, title: 'Feedback', ...stackScreenOptions }} />
            <Stack.Screen name="Timeline" component={TimelineScreen} options={{ headerShown: true, title: 'Activity', ...stackScreenOptions }} />
            <Stack.Screen name="Accessibility" component={AccessibilityScreen} options={{ headerShown: true, title: 'Accessibility', ...stackScreenOptions }} />
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