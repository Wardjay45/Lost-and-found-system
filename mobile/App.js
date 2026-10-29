import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AccessibilityProvider, useAccessibility } from './src/context/AccessibilityContext';
import { MessageBadgeProvider } from './src/context/MessageBadgeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { TTSStopButton } from './src/components/VoiceAssistant';
import FloatingThemeButton from './src/components/FloatingThemeButton';

function AppStatusBar() {
  const { activeTheme, themeColors } = useAccessibility();
  return <StatusBar style={activeTheme === 'light' ? 'dark' : 'light'} backgroundColor={themeColors.background} />;
}

function AppShell() {
  const { themeColors } = useAccessibility();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[shellStyles.container, { backgroundColor: themeColors.background }]}>
      <View style={shellStyles.navigator}>
        <AppNavigator />
      </View>
      <FloatingThemeButton />
      <TTSStopButton />
      <AppStatusBar />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AccessibilityProvider>
            <MessageBadgeProvider>
              <AppShell />
            </MessageBadgeProvider>
          </AccessibilityProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const shellStyles = StyleSheet.create({
  container: { flex: 1 },
  navigator: { flex: 1 },
});
