import React, { createContext, useState, useContext, useRef } from 'react';
import supabase from '../config/supabase';
import { initApiUrl } from '../config/api';
import { requestGoogleAuth } from '../services/googleAuth.mjs';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const signupInFlight = useRef(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const result = await requestGoogleAuth(await initApiUrl(), 'login', { email: email.trim().toLowerCase(), password });
      if (result.error) return result;
      if (!result.token || !result.user) return { error: 'The server did not confirm this login.' };
      setToken(result.token);
      setUser(result.user);
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { error: 'Login failed. Check your internet connection.' };
    } finally {
      setLoading(false);
    }
  };

  const googleRequest = async (endpoint, fields) => {
    if (signupInFlight.current) return { error: 'Account creation is already in progress.' };
    signupInFlight.current = true;
    setLoading(true);
    try {
      const result = await requestGoogleAuth(await initApiUrl(), endpoint, fields);
      if (result.token && result.user) {
        setToken(result.token);
        setUser(result.user);
      }
      return result;
    } catch {
      return { error: 'Unable to connect to the school server. Please try again.' };
    } finally {
      signupInFlight.current = false;
      setLoading(false);
    }
  };

  const continueWithGoogle = idToken => googleRequest('google', { google_id_token: idToken });
  const signup = fields => googleRequest('google/signup', fields);

  const updateProfile = async (updates) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (!error) {
        setUser(prev => ({ ...prev, ...updates }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{
      user, token, login, signup, continueWithGoogle, logout, updateProfile,
      isAuthenticated: !!user,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
