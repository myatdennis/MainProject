import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  lms: boolean;
  admin: boolean;
}

interface AuthContextType {
  isAuthenticated: AuthState;
  login: (type: 'lms' | 'admin') => void;
  logout: (type: 'lms' | 'admin') => void;
  user: {
    name: string;
    email: string;
    role: string;
    id: string;
  } | null;
  supabaseUser: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<AuthState>({
    lms: false,
    admin: false
  });
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);

  // Check for existing authentication on mount
  useEffect(() => {
    // Check for existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        const lmsAuth = localStorage.getItem('huddle_lms_auth') === 'true';
        const adminAuth = localStorage.getItem('huddle_admin_auth') === 'true';
        const savedUser = localStorage.getItem('huddle_user');

        setIsAuthenticated({
          lms: lmsAuth,
          admin: adminAuth
        });

        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (error) {
            console.error('Error parsing saved user data:', error);
            localStorage.removeItem('huddle_user');
          }
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setSupabaseUser(session.user);
        } else {
          setSupabaseUser(null);
          setIsAuthenticated({ lms: false, admin: false });
          setUser(null);
          localStorage.removeItem('huddle_lms_auth');
          localStorage.removeItem('huddle_admin_auth');
          localStorage.removeItem('huddle_user');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (type: 'lms' | 'admin') => {
    try {
      // Use demo credentials for authentication
      const credentials = type === 'admin' 
        ? { email: 'admin@thehuddleco.com', password: 'admin123' }
        : { email: 'user@pacificcoast.edu', password: 'user123' };

      // First try to sign up the user (in case they don't exist)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp(credentials);
      
      let currentUser = signUpData?.user;
      
      // If sign up fails because user already exists, try to sign in
      if (signUpError && signUpError.message.includes('already registered')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword(credentials);
        
        if (signInError) {
          console.error('Authentication error:', signInError);
          return;
        }
        
        currentUser = signInData?.user;
      } else if (signUpError) {
        console.error('Authentication error:', signUpError);
        return;
      }

      if (currentUser) {
        setSupabaseUser(currentUser);
      }

      localStorage.setItem(`huddle_${type}_auth`, 'true');
      
      // Set user data based on login type
      const userData = type === 'admin' 
        ? { 
            name: 'Mya Dennis', 
            email: 'admin@thehuddleco.com', 
            role: 'admin',
            id: currentUser?.id || ''
          }
        : { 
            name: 'Sarah Chen', 
            email: 'user@pacificcoast.edu', 
            role: 'user',
            id: currentUser?.id || ''
          };
      
      localStorage.setItem('huddle_user', JSON.stringify(userData));
      
      setIsAuthenticated(prev => ({
        ...prev,
        [type]: true
      }));
      setUser(userData);

      // Create user profile if it doesn't exist
      if (currentUser) {
        await supabase
          .from('user_profiles')
          .upsert({
            user_id: currentUser.id,
            name: userData.name,
            email: userData.email,
            role: userData.role
          });
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async (type: 'lms' | 'admin') => {
    try {
      await supabase.auth.signOut();
      
      localStorage.removeItem(`huddle_${type}_auth`);
      localStorage.removeItem('huddle_user');
      
      setIsAuthenticated(prev => ({
        ...prev,
        [type]: false
      }));
      setUser(null);
      setSupabaseUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      login,
      logout,
      user,
      supabaseUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};