/**
 * Authentication Routes
 * Login, register, token refresh, and logout endpoints
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.ts';
import { authenticate, authLimiter } from '../middleware/auth.ts';
import { supabase } from '../lib/supabaseClient.ts';

const router = express.Router();

// Cookie configuration (allow overriding via env)
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined; // e.g. ".the-huddle.co"
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'strict');

// ============================================================================
// Login
// ============================================================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Generate a request id for correlation and expose it in responses
    const reqId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    res.setHeader('x-request-id', reqId);
    const VERBOSE = process.env.AUTH_DIAG_VERBOSE === 'true';

    // Helper to write a verbose diagnostic for every auth attempt when enabled.
    const writeAttempt = async (outcome: string, details: Record<string, any> = {}) => {
      if (!VERBOSE) return;
      try {
  const diagDir = path.join(process.cwd(), 'server', 'diagnostics');
        await fs.promises.mkdir(diagDir, { recursive: true });
        const diag = Object.assign({
          timestamp: new Date().toISOString(),
          route: '/api/auth/login',
          requestId: reqId,
          outcome,
          headers: req.headers,
          body: req.body,
        }, details);
        const fileName = `auth-attempt-${reqId}.json`;
        await fs.promises.writeFile(path.join(diagDir, fileName), JSON.stringify(diag, null, 2), 'utf8');
      } catch (e) {
        console.error('Failed to write auth verbose diagnostic:', e);
      }
    };
    
    // Validate input
    if (!email || !password) {
      await writeAttempt('missing_credentials');
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required',
      });
    }
    
  // Demo mode check
    if (process.env.DEMO_MODE === 'true') {
      // Demo credentials
      const demoUsers = {
        'admin@thehuddleco.com': {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@thehuddleco.com',
          role: 'admin',
          firstName: 'Admin',
          lastName: 'User',
          password: 'admin123',
        },
        'user@pacificcoast.edu': {
          id: '00000000-0000-0000-0000-000000000002',
          email: 'user@pacificcoast.edu',
          role: 'user',
          firstName: 'Demo',
          lastName: 'User',
          password: 'user123',
        },
      };
      
      const demoUser = demoUsers[email as keyof typeof demoUsers];
      
      if (demoUser && password === demoUser.password) {
        const tokens = generateTokens({
          userId: demoUser.id,
          email: demoUser.email,
          role: demoUser.role,
        });
        await writeAttempt('success', { userId: demoUser.id, email: demoUser.email, mode: 'demo' });
        return res.json({
          user: {
            id: demoUser.id,
            email: demoUser.email,
            role: demoUser.role,
            firstName: demoUser.firstName,
            lastName: demoUser.lastName,
          },
          // Do not include raw tokens in diagnostics; return them in response as before
          ...tokens,
        });
      }
    }
    
    // Real authentication with Supabase
    if (!supabase) {
      // If Supabase is not configured, return 503. Also write a small
      // diagnostic file for troubleshooting demo vs real-auth mismatches.
      try {
  const diagDir = path.join(process.cwd(), 'server', 'diagnostics');
        await fs.promises.mkdir(diagDir, { recursive: true });
        const diag = {
          timestamp: new Date().toISOString(),
          route: '/api/auth/login',
          reason: 'supabase_unconfigured',
          headers: req.headers,
          body: req.body,
        };
        const fileName = `auth-unconfigured-${Date.now()}-${Math.random().toString(36).slice(2,8)}.json`;
        await fs.promises.writeFile(path.join(diagDir, fileName), JSON.stringify(diag, null, 2), 'utf8');
        // If verbose diagnostics enabled, also write a correlated attempt file
        await writeAttempt('supabase_unconfigured');
      } catch (e) {
        // non-fatal — continue to return 503
        console.error('Failed to write auth diagnostics:', e);
      }

      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Authentication service not configured',
      });
    }
    
    // Get user from database
    const { data: users, error: queryError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .limit(1);
    
    if (queryError || !users || users.length === 0) {
      // write diagnostic for invalid credentials attempts when supabase is configured
      try {
  const diagDir = path.join(process.cwd(), 'server', 'diagnostics');
        await fs.promises.mkdir(diagDir, { recursive: true });
        const diag = {
          timestamp: new Date().toISOString(),
          route: '/api/auth/login',
          reason: 'invalid_credentials',
          headers: req.headers,
          body: req.body,
        };
        const fileName = `auth-invalid-${Date.now()}-${Math.random().toString(36).slice(2,8)}.json`;
        await fs.promises.writeFile(path.join(diagDir, fileName), JSON.stringify(diag, null, 2), 'utf8');
      } catch (e) {
        console.error('Failed to write invalid-credentials diagnostic:', e);
      }
      await writeAttempt('invalid_credentials');
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }
    
    const user = users[0];
    
    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Account disabled',
        message: 'Your account has been disabled',
      });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      await writeAttempt('invalid_credentials_password_mismatch', { userId: user.id });
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }
    
    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    });
    
    // Set tokens as httpOnly, secure cookies
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: COOKIE_SAMESITE as any,
      domain: COOKIE_DOMAIN,
      maxAge: 1000 * 60 * 15 // 15 minutes
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: COOKIE_SAMESITE as any,
      domain: COOKIE_DOMAIN,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        organizationId: user.organization_id,
      }
    });
    await writeAttempt('success', { userId: user.id, email: user.email });
  } catch (error) {
    try {
      // Attempt to write error diagnostics if verbose mode is on
      await (async () => {
        if (process.env.AUTH_DIAG_VERBOSE === 'true') {
          const diagDir = path.resolve(__dirname, '..', 'diagnostics');
          await fs.promises.mkdir(diagDir, { recursive: true });
          const diag = {
            timestamp: new Date().toISOString(),
            route: '/api/auth/login',
            requestId: (res.getHeader && res.getHeader('x-request-id')) || null,
            outcome: 'exception',
            error: String(error),
            headers: req.headers,
            body: req.body,
          };
          const fileName = `auth-exception-${Date.now()}-${Math.random().toString(36).slice(2,8)}.json`;
          await fs.promises.writeFile(path.join(diagDir, fileName), JSON.stringify(diag, null, 2), 'utf8');
        }
      })();
    } catch (e) {
      console.error('Failed to write exception diagnostic:', e);
    }
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during login',
    });
  }
});

// ============================================================================
// Register
// ============================================================================

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'All fields are required',
      });
    }
    
    if (!supabase) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Authentication service not configured',
      });
    }
    
    // Check if user already exists
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .limit(1);
    
    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        error: 'User exists',
        message: 'An account with this email already exists',
      });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role: 'user', // Default role
        is_active: true,
      })
      .select()
      .single();
    
    if (createError || !newUser) {
      console.error('User creation error:', createError);
      return res.status(500).json({
        error: 'Registration failed',
        message: 'Could not create account',
      });
    }
    
    // Generate tokens
    const tokens = generateTokens({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });
    
    // Set tokens as httpOnly, secure cookies
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: COOKIE_SAMESITE as any,
      domain: COOKIE_DOMAIN,
      maxAge: 1000 * 60 * 15 // 15 minutes
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: COOKIE_SAMESITE as any,
      domain: COOKIE_DOMAIN,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    });
    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during registration',
    });
  }
});

// ============================================================================
// Token Refresh
// ============================================================================

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Missing token',
        message: 'Refresh token is required',
      });
    }
    
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    
    if (!payload) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Refresh token is invalid or expired',
      });
    }
    
    // Get user from database
    if (!supabase) {
      return res.status(503).json({
        error: 'Service unavailable',
      });
    }
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.userId)
      .single();
    
    if (userError || !user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Invalid refresh token',
      });
    }
    
    // Check if user is still active
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Account disabled',
      });
    }
    
    // Generate new tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    });
    
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: COOKIE_SAMESITE as any,
      domain: COOKIE_DOMAIN,
      maxAge: 1000 * 60 * 15 // 15 minutes
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: COOKIE_SAMESITE as any,
      domain: COOKIE_DOMAIN,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during token refresh',
    });
  }
});

// ============================================================================
// Verify Token
// ============================================================================

router.get('/verify', authenticate, async (req, res) => {
  // If we got here, token is valid (authenticate middleware succeeded)
  res.json({
    valid: true,
    user: req.user,
  });
});

// ============================================================================
// Logout
// ============================================================================

router.post('/logout', authenticate, async (req, res) => {
  // Clear auth cookies
  res.clearCookie('access_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: COOKIE_SAMESITE as any, domain: COOKIE_DOMAIN });
  res.clearCookie('refresh_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: COOKIE_SAMESITE as any, domain: COOKIE_DOMAIN });
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// ============================================================================
// Get Current User
// ============================================================================

router.get('/me', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      });
    }
    
    if (!supabase) {
      // Return token data in demo mode
      return res.json({
        user: req.user,
      });
    }
    
    // Get fresh user data from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, organization_id, is_active')
      .eq('id', req.user.userId)
      .single();
    
    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        organizationId: user.organization_id,
        isActive: user.is_active,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;
