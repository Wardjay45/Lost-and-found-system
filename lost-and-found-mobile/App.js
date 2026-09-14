import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { AccessibilityProvider } from './src/context/AccessibilityContext';
import { MessageBadgeProvider } from './src/context/MessageBadgeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { TTSStopButton } from './src/components/VoiceAssistant';

export default function App() {
  return (
    <AuthProvider>
      <AccessibilityProvider>
        <MessageBadgeProvider>
          <AppNavigator />
          <TTSStopButton />
          <StatusBar style="auto" />
        </MessageBadgeProvider>
      </AccessibilityProvider>
    </AuthProvider>
  );
}
