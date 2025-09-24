import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  lms: boolean;
  admin: boolean;
}

interface AuthContextType {
  isAuthenticated: AuthState;
  login: (email: string, password: string, type: 'lms' | 'admin') => Promise<{ success: boolean; error?: string }>;
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

  const login = async (email: string, password: string, type: 'lms' | 'admin'): Promise<{ success: boolean; error?: string }> => {
    try {
      const credentials = { email, password };

      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        // Demo/development authentication bypass when Supabase is not configured
        console.info('Using demo authentication mode - Supabase not configured');
        
        const validCredentials = [
          { email: 'admin@thehuddleco.com', password: 'admin123', type: 'admin' },
          { email: 'demo@thehuddleco.com', password: 'demo123', type: 'lms' },
          { email: 'user@pacificcoast.edu', password: 'user123', type: 'lms' } // Added the default LMS credential
        ];
        
        const isValid = validCredentials.some(cred => 
          cred.email === email && cred.password === password && cred.type === type
        );
        
        if (!isValid) {
          console.error('Invalid demo credentials for type:', type);
          return { 
            success: false, 
            error: `Demo mode: Invalid credentials. ${type === 'admin' ? 'Use admin@thehuddleco.com / admin123' : 'Use user@pacificcoast.edu / user123 or demo@thehuddleco.com / demo123'}`
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
        return { success: true };
      }

      // Supabase authentication
      console.info('Using Supabase authentication');
      
      // Try sign in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword(credentials);
      let currentUser = signInData?.user;

      if (signInError || !currentUser) {
        // Check if it's a configuration error
        if (signInError?.message?.includes('Supabase not configured')) {
          return { 
            success: false, 
            error: 'Database configuration error. Please check your .env.local file and ensure Supabase credentials are set up correctly.'
          };
        }

        // Try sign up (for development/demo) and then sign in again
        const { error: signUpError } = await supabase.auth.signUp(credentials);
        if (signUpError) {
          console.warn('Sign-up attempt failed (may require confirmation):', signUpError.message || signUpError);
        }

        const { data: signInData2, error: signInError2 } = await supabase.auth.signInWithPassword(credentials);
        if (signInError2 || !signInData2?.user) {
          console.error('Authentication error during sign-in:', signInError2);
          
          // Provide user-friendly error messages
          const errorMessage = signInError2?.message || 'Authentication failed';
          if (errorMessage.includes('Invalid login credentials')) {
            return { success: false, error: 'Invalid email or password. Please check your credentials and try again.' };
          } else if (errorMessage.includes('Email not confirmed')) {
            return { success: false, error: 'Please check your email and confirm your account before signing in.' };
          } else if (errorMessage.includes('Supabase not configured')) {
            return { success: false, error: 'Database configuration error. Please contact support.' };
          }
          
          return { success: false, error: `Authentication failed: ${errorMessage}` };
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
        const { error: profileError } = await supabase.from('user_profiles').upsert({
          user_id: currentUser.id,
          name: userData.name,
          email: userData.email,
          role: userData.role
        });
        
        if (profileError && !profileError.message.includes('Supabase not configured')) {
          console.warn('Profile update failed:', profileError);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: `Login failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      };
    }
  };

  const forgotPassword = async (email: string) => {
    try {
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