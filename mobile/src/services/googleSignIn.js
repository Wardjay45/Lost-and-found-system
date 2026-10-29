import { Platform } from 'react-native';

export async function selectSchoolGoogleAccount() {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) return { error: 'Google sign-in is not configured yet. Please contact the administrator.' };
  if (Platform.OS === 'web') return { error: 'Please use the installed mobile app to continue with Google.' };
  let statusCodes = {};
  try {
    const googleSignIn = require('@react-native-google-signin/google-signin');
    const { GoogleSignin, isSuccessResponse } = googleSignIn;
    statusCodes = googleSignIn.statusCodes;
    GoogleSignin.configure({ webClientId, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signOut();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { cancelled: true };
    if (!response.data.idToken) return { error: 'Google did not return a verification token. Please try again.' };
    return { idToken: response.data.idToken };
  } catch (error) {
    const code = String(error?.code ?? 'unknown');
    if (code === statusCodes.SIGN_IN_CANCELLED) return { cancelled: true };
    if (code === '10' || code === 'DEVELOPER_ERROR') {
      return { error: 'Google sign-in configuration mismatch (code: 10). Ask the administrator to check this APK\'s package name and signing SHA-1, and the Web OAuth client in the same Google Cloud project.' };
    }
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { error: 'Please update or enable Google Play services on your phone, then try again.' };
    }
    if (code === statusCodes.IN_PROGRESS) {
      return { error: 'Google sign-in is already in progress. Finish or close the Google window, then try again.' };
    }
    if (/RNGoogleSignin|native module|TurboModule/i.test(error?.message || '')) {
      return { error: 'Install the latest mobile app build to use Google sign-in. Expo Go does not support this feature.' };
    }
    const safeCode = /^[a-zA-Z0-9_-]{1,64}$/.test(code) ? code : 'unknown';
    return { error: `Google sign-in could not start (code: ${safeCode}). Please try again and share this code with the administrator if it continues.` };
  }
}
