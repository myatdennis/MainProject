/**
 * Authentication Routes
 * Login, register, token refresh, and logout endpoints
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.js';
import { authenticate, authLimiter } from '../middleware/auth.js';
import supabase from '../lib/supabaseClient.js';

const router = express.Router();

router.use((req, _res, next) => {
  const { method, originalUrl, headers } = req;
  console.log(`[AUTH ROUTER] ${method} ${originalUrl} origin=${headers.origin || 'n/a'}`);
  next();
});

// ============================================================================
// Login
// ============================================================================

router.post('/login', async (req, res) => {
  const origin = req.headers.origin || 'unknown';
  console.log(`[AUTH] Incoming ${req.method} ${req.originalUrl} from origin ${origin}`);
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required',
      });
    }
    
      const origin = req.headers.origin || 'unknown';
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
      console.log(`[AUTH] ${req.method} ${req.originalUrl} from origin ${origin} ip ${ip}`);
    // Demo mode check
    const DEV_FALLBACK = (process.env.DEV_FALLBACK || '').toLowerCase() !== 'false' && 
                         (process.env.NODE_ENV || '').toLowerCase() !== 'production';
    const useDemoMode = process.env.DEMO_MODE === 'true' || 
                        process.env.E2E_TEST_MODE === 'true' || 
                        DEV_FALLBACK;
                        
    if (useDemoMode) {
      console.log('[AUTH ROUTES] Using demo mode authentication');
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
      
      const demoUser = demoUsers[email];
      
      if (demoUser && password === demoUser.password) {
        const tokens = generateTokens({
          userId: demoUser.id,
          email: demoUser.email,
          role: demoUser.role,
        });
        
        return res.json({
          user: {
            id: demoUser.id,
            email: demoUser.email,
            role: demoUser.role,
            firstName: demoUser.firstName,
            lastName: demoUser.lastName,
          },
          ...tokens,
        });
      }
    }
    
    // Real authentication with Supabase
    if (!supabase) {
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
    
    // Return user data and tokens
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        organizationId: user.organization_id,
      },
      ...tokens,
    });
  } catch (error) {
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
    
    // Return user data and tokens
    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
      },
      ...tokens,
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
    
    // Demo mode - skip database check
    if (process.env.DEMO_MODE === 'true' || process.env.E2E_TEST_MODE === 'true') {
      const tokens = generateTokens({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });
      return res.json(tokens);
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
    
    res.json(tokens);
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
  // In a real implementation, you might want to blacklist the token
  // For now, just send success response
  // Client will clear tokens from storage
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
    
    if (!supabase || process.env.DEMO_MODE === 'true' || process.env.E2E_TEST_MODE === 'true') {
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
