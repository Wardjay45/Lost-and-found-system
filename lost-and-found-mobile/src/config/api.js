// Server API configuration
// Supports dynamic server URL configuration via AsyncStorage
// Falls back to auto-detection from Metro bundler or emulator defaults
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const STORAGE_KEY = '@lost_and_found_server_url';

let cachedApiUrl = null;

// Load persisted server URL from AsyncStorage
const loadPersistedUrl = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      cachedApiUrl = stored;
      return stored;
    }
  } catch (e) {
    console.warn('Failed to load server URL from storage:', e);
  }
  return null;
};

// Save server URL to AsyncStorage
export const saveServerUrl = async (url) => {
  try {
    const cleanUrl = url.replace(/\/+$/, ''); // Remove trailing slashes
    await AsyncStorage.setItem(STORAGE_KEY, cleanUrl);
    cachedApiUrl = cleanUrl;
    return true;
  } catch (e) {
    console.warn('Failed to save server URL:', e);
    return false;
  }
};

// Get the current configured server URL
export const getConfiguredServerUrl = async () => {
  if (cachedApiUrl) return cachedApiUrl;
  return await loadPersistedUrl();
};

// Clear persisted server URL (reset to auto-detect)
export const resetServerUrl = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    cachedApiUrl = null;
    return true;
  } catch (e) {
    console.warn('Failed to reset server URL:', e);
    return false;
  }
};

// Auto-detect server URL from environment
const autoDetectUrl = () => {
  const manifest = Constants.expoConfig || Constants.manifest;

  // Try to get from Metro bundler (works in Expo Go dev mode only)
  const debuggerHost = manifest?.hostUri || manifest?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:3001/api`;
  }

  // Standalone APK / real device — fallback to 10.0.2.2 for emulator,
  // but on real device this won't work and user MUST configure via ⚙️
  return 'http://10.0.2.2:3001/api';
};

// Synchronous getter for initial render (uses cached or auto-detect)
export const getApiUrl = () => {
  return cachedApiUrl || autoDetectUrl();
};

// Async initializer - call this early in app startup
let initPromise = null;
export const initApiUrl = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      const persisted = await loadPersistedUrl();
      if (!persisted) {
        cachedApiUrl = autoDetectUrl();
      }
      return cachedApiUrl;
    })();
  }
  return initPromise;
};

// Default export for convenience (synchronous - use getApiUrl or ensure initApiUrl ran first)
export const API_URL = getApiUrl();