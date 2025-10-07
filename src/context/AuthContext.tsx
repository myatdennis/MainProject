import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  lms: boolean;
  admin: boolean;
}

interface LoginResult {
  success: boolean;
  error?: string;
  errorType?: 'invalid_credentials' | 'network_error' | 'supabase_config' | 'unknown_error';
}

interface AuthContextType {
  isAuthenticated: AuthState;
  login: (email: string, password: string, type: 'lms' | 'admin') => Promise<LoginResult>;
  logout: (type: 'lms' | 'admin') => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
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
    supabase.auth.getSession().then((res: { data: { session: Session | null } }) => {
      const session: Session | null = res.data.session;
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
    const { data } = supabase.auth.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        // eslint-disable-next-line no-console
        console.log('AuthContext auth state change, has session:', !!session);
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

    return () => data.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string, type: 'lms' | 'admin'): Promise<LoginResult> => {
    try {
      const credentials = { email, password };

      // For demo purposes, allow admin login with specific credentials when Supabase isn't configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('Running in demo mode - Supabase not configured');
        
        // Demo/development authentication bypass
        const validCredentials = [
          { email: 'admin@thehuddleco.com', password: 'admin123', type: 'admin' },
          { email: 'demo@thehuddleco.com', password: 'demo123', type: 'lms' },
          { email: 'user@pacificcoast.edu', password: 'user123', type: 'lms' } // Additional demo credential
        ];
        
        const isValid = validCredentials.some(cred => 
          cred.email === email && cred.password === password && cred.type === type
        );
        
        if (!isValid) {
          console.error('Invalid demo credentials:', { email, type });
          return {
            success: false,
            error: 'Invalid credentials. For demo mode, use: user@pacificcoast.edu / user123 for LMS or demo@thehuddleco.com / demo123',
            errorType: 'invalid_credentials'
          };
        }
        
        // Set up demo user
        localStorage.setItem(`huddle_${type}_auth`, 'true');
        const userData = {
          name: type === 'admin' ? 'Mya Dennis' : 'Sarah Chen',
          email,
          role: type === 'admin' ? 'admin' : 'user',
          id: `demo-${type}-${Date.now()}`
        };
        localStorage.setItem('huddle_user', JSON.stringify(userData));
        setIsAuthenticated(prev => ({ ...prev, [type]: true }));
        setUser(userData);
        
        console.log('Demo login successful for:', email);
        return { success: true };
      }

      // Production Supabase authentication
      console.log('Attempting Supabase authentication for:', email);
      
      // Try sign in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword(credentials);
      let currentUser = signInData?.user;

      if (signInError || !currentUser) {
        console.log('Initial sign-in failed, attempting sign-up for development:', signInError?.message);
        
        // Try sign up (dev/demo) and then sign in again
        const { error: signUpError } = await supabase.auth.signUp(credentials);
        if (signUpError) {
          console.warn('Sign-up attempt failed (may require confirmation):', signUpError.message || signUpError);
        }

        const { data: signInData2, error: signInError2 } = await supabase.auth.signInWithPassword(credentials);
        if (signInError2 || !signInData2?.user) {
          console.error('Authentication error during sign-in retry:', signInError2);
          
          // Check specific error types
          if (signInError2?.message?.includes('Invalid login credentials')) {
            return {
              success: false,
              error: 'Invalid email or password. Please check your credentials and try again.',
              errorType: 'invalid_credentials'
            };
          } else if (signInError2?.message?.includes('Email not confirmed')) {
            return {
              success: false,
              error: 'Please check your email and click the confirmation link before signing in.',
              errorType: 'invalid_credentials'
            };
          } else {
            return {
              success: false,
              error: `Authentication failed: ${signInError2?.message || 'Unknown error'}`,
              errorType: 'unknown_error'
            };
          }
        }
        currentUser = signInData2.user;
      }

      if (currentUser) {
        setSupabaseUser(currentUser);
      }

      // persist a local auth flag for quick front-end checks
      localStorage.setItem(`huddle_${type}_auth`, 'true');

      const userData = {
        name: type === 'admin' ? 'Mya Dennis' : 'Sarah Chen',
        email,
        role: type === 'admin' ? 'admin' : 'user',
        id: currentUser?.id || ''
      };

      localStorage.setItem('huddle_user', JSON.stringify(userData));

      setIsAuthenticated(prev => ({ ...prev, [type]: true }));
      setUser(userData);

      // Create or update user profile in Supabase
      if (currentUser) {
        try {
          await supabase.from('user_profiles').upsert({
            user_id: currentUser.id,
            name: userData.name,
            email: userData.email,
            role: userData.role
          });
        } catch (profileError) {
          console.warn('Failed to update user profile:', profileError);
          // Don't fail login if profile update fails
        }
      }

      console.log('Supabase login successful for:', email);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      
      // Check if it's a network error
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          success: false,
          error: 'Network error. Please check your internet connection and try again.',
          errorType: 'network_error'
        };
      }
      
      return {
        success: false,
        error: `Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorType: 'unknown_error'
      };
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.log('Forgot password requested in demo mode for:', email);
        // In demo mode, we can't actually send password reset emails
        // but we can provide helpful guidance
        return false; // This will show the helpful error message in the UI
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) {
        console.error('Forgot password error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Forgot password exception:', err);
      return false;
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
      forgotPassword,
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