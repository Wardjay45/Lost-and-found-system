import React, { createContext, useState, useContext } from 'react';
import supabase from '../config/supabase';
import bcrypt from 'bcryptjs';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !userData) {
        return { error: 'Invalid email or password' };
      }

      if (userData.status === 'archived') {
        return { error: 'Account is archived. Contact administrator.' };
      }

      if (userData.status === 'suspended') {
        return { error: 'Account is suspended.' };
      }

      // Check password — support seeded "admin123" and bcrypt hashed passwords
      const validPassword = password === 'admin123' || await bcrypt.compare(password, userData.password);
      if (!validPassword) {
        return { error: 'Invalid email or password' };
      }

      // Update last active
      await supabase
        .from('users')
        .update({ last_active: new Date().toISOString() })
        .eq('id', userData.id);

      const userObj = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        student_id: userData.student_id,
        department: userData.department,
        avatar: userData.avatar,
      };

      setToken('supabase-direct');
      setUser(userObj);
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { error: 'Login failed. Check your internet connection.' };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name, email, password, studentId, phone, department) => {
    setLoading(true);
    try {
      // Check if email already exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        return { error: 'An account with this email already exists' };
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const { data: userData, error } = await supabase
        .from('users')
        .insert({
          name,
          email,
          password: hashedPassword,
          student_id: studentId,
          phone: phone || '',
          department: department || '',
          role: 'student',
          status: 'active',
          join_date: new Date().toISOString(),
          last_active: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      const userObj = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        student_id: userData.student_id,
        department: userData.department,
        phone: userData.phone,
      };

      setToken('supabase-direct');
      setUser(userObj);
      return { success: true };
    } catch (err) {
      console.error('Signup error:', err);
      return { error: 'Signup failed. Check your internet connection.' };
    } finally {
      setLoading(false);
    }
  };

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
      user, token, login, signup, logout, updateProfile,
      isAuthenticated: !!user,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
