import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  lms: boolean;
  admin: boolean;
}

interface AuthContextType {
  isAuthenticated: AuthState;
  login: (email: string, password: string, type: 'lms' | 'admin') => Promise<boolean>;
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

  const login = async (email: string, password: string, type: 'lms' | 'admin') => {
    try {
      const credentials = { email, password };

      // For demo purposes, allow admin login with specific credentials when Supabase isn't configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        // Demo/development authentication bypass
        const validCredentials = [
          { email: 'admin@thehuddleco.com', password: 'admin123', type: 'admin' },
          { email: 'user@pacificcoast.edu', password: 'user123', type: 'lms' }
        ];
        
        const isValid = validCredentials.some(cred => 
          cred.email === email && cred.password === password && cred.type === type
        );
        
        if (!isValid) {
          console.error('Invalid demo credentials');
          return false;
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
        return true;
      }

      // Try sign in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword(credentials);
      let currentUser = signInData?.user;

      if (signInError || !currentUser) {
        // Try sign up (dev/demo) and then sign in again
        const { error: signUpError } = await supabase.auth.signUp(credentials);
        if (signUpError) {
          console.warn('Sign-up attempt failed (may require confirmation):', signUpError.message || signUpError);
        }

        const { data: signInData2, error: signInError2 } = await supabase.auth.signInWithPassword(credentials);
        if (signInError2 || !signInData2?.user) {
          console.error('Authentication error during sign-in:', signInError2 || 'no user returned');
          return false;
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
        await supabase.from('user_profiles').upsert({
          user_id: currentUser.id,
          name: userData.name,
          email: userData.email,
          role: userData.role
        });
      }

      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
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