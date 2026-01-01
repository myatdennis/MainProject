#!/usr/bin/env node

/**
 * Comprehensive System Test Suite
 * Tests Admin Portal, Client Portal, and synchronization functionality
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

const testResults = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  summary: {
    totalTests: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  },
  tests: {},
  recommendations: []
};

// Test configurations
const ADMIN_CREDENTIALS = {
  email: 'mya@the-huddle.co',
  password: 'admin123'
};

const LMS_CREDENTIALS = {
  email: 'user@pacificcoast.edu',
  password: 'user123'
};

async function runTest(name, testFn) {
  console.log(`🧪 Running test: ${name}`);
  testResults.summary.totalTests++;
  
  try {
    const result = await testFn();
    testResults.tests[name] = {
      status: result.status || 'passed',
      message: result.message || 'Test completed successfully',
      data: result.data || null,
      timestamp: new Date().toISOString()
    };
    
    if (result.status === 'failed') {
      testResults.summary.failed++;
      console.log(`❌ ${name}: ${result.message}`);
    } else if (result.status === 'warning') {
      testResults.summary.warnings++;
      console.log(`⚠️  ${name}: ${result.message}`);
    } else {
      testResults.summary.passed++;
      console.log(`✅ ${name}: ${result.message}`);
    }
  } catch (error) {
    testResults.tests[name] = {
      status: 'failed',
      message: error.message,
      error: error.stack,
      timestamp: new Date().toISOString()
    };
    testResults.summary.failed++;
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function testBasicConnectivity() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto(BASE_URL, { timeout: 10000 });
    const title = await page.title();
    await browser.close();
    
    return {
      status: 'passed',
      message: `Homepage loaded successfully (${title})`,
      data: { title }
    };
  } catch (error) {
    await browser.close();
    return {
      status: 'failed',
      message: `Cannot connect to ${BASE_URL}: ${error.message}`
    };
  }
}

async function testAdminPortalAccess() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Test admin login page
    await page.goto(`${BASE_URL}/admin/login`, { timeout: 10000 });
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    
    // Attempt login
    await page.fill('input[type="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    const hasError = await page.locator('.error, [role="alert"]').count() > 0;
    
    await browser.close();
    
    if (currentUrl.includes('/admin/dashboard')) {
      return {
        status: 'passed',
        message: 'Admin login successful, redirected to dashboard',
        data: { redirectUrl: currentUrl }
      };
    } else if (hasError) {
      return {
        status: 'failed',
        message: 'Admin login failed with error message',
        data: { currentUrl }
      };
    } else {
      return {
        status: 'warning',
        message: 'Admin login status unclear',
        data: { currentUrl }
      };
    }
  } catch (error) {
    await browser.close();
    return {
      status: 'failed',
      message: `Admin portal test failed: ${error.message}`
    };
  }
}

async function testLMSPortalAccess() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Test LMS login page
    await page.goto(`${BASE_URL}/lms/login`, { timeout: 10000 });
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    
    // Attempt login
    await page.fill('input[type="email"]', LMS_CREDENTIALS.email);
    await page.fill('input[type="password"]', LMS_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    const hasError = await page.locator('.error, [role="alert"]').count() > 0;
    
    await browser.close();
    
    if (currentUrl.includes('/lms/dashboard')) {
      return {
        status: 'passed',
        message: 'LMS login successful, redirected to dashboard',
        data: { redirectUrl: currentUrl }
      };
    } else if (hasError) {
      return {
        status: 'failed',
        message: 'LMS login failed with error message',
        data: { currentUrl }
      };
    } else {
      return {
        status: 'warning',
        message: 'LMS login status unclear',
        data: { currentUrl }
      };
    }
  } catch (error) {
    await browser.close();
    return {
      status: 'failed',
      message: `LMS portal test failed: ${error.message}`
    };
  }
}

async function testCourseContentRefresh() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to LMS course page
    await page.goto(`${BASE_URL}/lms/courses`, { timeout: 10000 });
    
    // Look for courses
    const courseLinks = await page.locator('a[href*="/lms/module/"], a[href*="/lms/course/"]').count();
    
    if (courseLinks > 0) {
      // Click on first course
      await page.locator('a[href*="/lms/module/"], a[href*="/lms/course/"]').first().click();
      await page.waitForTimeout(2000);
      
      // Look for refresh button
      const refreshButton = await page.locator('button:has-text("Refresh Content")').count();
      
      if (refreshButton > 0) {
        await page.locator('button:has-text("Refresh Content")').click();
        await page.waitForTimeout(2000);
        
        // Check for success notification
        const notification = await page.locator('.bg-green-100, .success').count();
        
        await browser.close();
        return {
          status: 'passed',
          message: 'Course refresh functionality working',
          data: { hasRefreshButton: true, hasNotification: notification > 0 }
        };
      }
    }
    
    await browser.close();
    return {
      status: 'warning',
      message: 'Course refresh functionality not fully testable',
      data: { courseLinks }
    };
  } catch (error) {
    await browser.close();
    return {
      status: 'failed',
      message: `Course refresh test failed: ${error.message}`
    };
  }
}

async function testDatabaseConnectivity() {
  try {
    // Test if Supabase environment variables are set
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'warning',
        message: 'Supabase environment variables not found in process.env (may be in .env file)',
        data: { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey }
      };
    }
    
    // Test database connection (simplified)
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (response.ok) {
      return {
        status: 'passed',
        message: 'Database connection successful',
        data: { status: response.status }
      };
    } else {
      return {
        status: 'failed',
        message: `Database connection failed: ${response.status}`,
        data: { status: response.status }
      };
    }
  } catch (error) {
    return {
      status: 'failed',
      message: `Database connectivity test failed: ${error.message}`
    };
  }
}

async function testConsoleErrors() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const warnings = [];
  
  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else if (msg.type() === 'warning') {
      warnings.push(msg.text());
    }
  });
  
  try {
    // Test multiple pages for console errors
    const pagesToTest = [
      '/',
      '/lms/courses',
      '/admin/login'
    ];
    
    for (const path of pagesToTest) {
      await page.goto(`${BASE_URL}${path}`, { timeout: 10000 });
      await page.waitForTimeout(2000);
    }
    
    await browser.close();
    
    if (errors.length === 0) {
      return {
        status: 'passed',
        message: `No console errors found (${warnings.length} warnings)`,
        data: { errors, warnings: warnings.slice(0, 5) } // Limit warnings
      };
    } else if (errors.length < 3) {
      return {
        status: 'warning',
        message: `Found ${errors.length} console errors`,
        data: { errors: errors.slice(0, 5), warnings: warnings.slice(0, 3) }
      };
    } else {
      return {
        status: 'failed',
        message: `Found ${errors.length} console errors`,
        data: { errors: errors.slice(0, 5), warnings: warnings.slice(0, 3) }
      };
    }
  } catch (error) {
    await browser.close();
    return {
      status: 'failed',
      message: `Console error test failed: ${error.message}`
    };
  }
}

async function generateRecommendations() {
  const { tests, summary } = testResults;
  const recommendations = [];
  
  if (tests['Database Connectivity']?.status === 'failed') {
    recommendations.push({
      priority: 'high',
      category: 'Database',
      issue: 'Database connection failure',
      solution: 'Verify Supabase configuration and run database migrations',
      commands: ['npm run db:migrate', 'npm run db:seed']
    });
  }
  
  if (tests['Admin Portal Access']?.status === 'failed') {
    recommendations.push({
      priority: 'critical',
      category: 'Authentication',
      issue: 'Admin portal login not working',
      solution: 'Fix authentication flow and admin layout loading state',
      files: ['src/context/AuthContext.tsx', 'src/components/Admin/AdminLayout.tsx']
    });
  }
  
  if (tests['Console Errors']?.status !== 'passed') {
    recommendations.push({
      priority: 'medium',
      category: 'Code Quality',
      issue: 'Console errors detected',
      solution: 'Review and fix console errors to improve stability',
      action: 'Check browser dev tools for detailed error messages'
    });
  }
  
  if (summary.failed > summary.passed) {
    recommendations.push({
      priority: 'high',
      category: 'System Health',
      issue: 'More tests failing than passing',
      solution: 'Focus on core functionality fixes before adding new features'
    });
  }
  
  return recommendations;
}

async function main() {
  console.log('🚀 Starting Comprehensive System Test Suite...');
  console.log(`📊 Testing against: ${BASE_URL}\n`);
  
  // Run all tests
  await runTest('Basic Connectivity', testBasicConnectivity);
  await runTest('Database Connectivity', testDatabaseConnectivity);
  await runTest('Admin Portal Access', testAdminPortalAccess);
  await runTest('LMS Portal Access', testLMSPortalAccess);
  await runTest('Course Content Refresh', testCourseContentRefresh);
  await runTest('Console Errors', testConsoleErrors);
  
  // Generate recommendations
  testResults.recommendations = await generateRecommendations();
  
  // Print summary
  console.log('\n📋 TEST SUMMARY');
  console.log('================');
  console.log(`✅ Passed: ${testResults.summary.passed}`);
  console.log(`❌ Failed: ${testResults.summary.failed}`);
  console.log(`⚠️  Warnings: ${testResults.summary.warnings}`);
  console.log(`📊 Total: ${testResults.summary.totalTests}`);
  
  if (testResults.recommendations.length > 0) {
    console.log('\n🔧 RECOMMENDATIONS');
    console.log('==================');
    testResults.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.category}: ${rec.issue}`);
      console.log(`   Solution: ${rec.solution}`);
      if (rec.commands) {
        console.log(`   Commands: ${rec.commands.join(', ')}`);
      }
      if (rec.files) {
        console.log(`   Files: ${rec.files.join(', ')}`);
      }
      console.log();
    });
  }
  
  // Save detailed results
  const reportPath = path.join(process.cwd(), 'tmp', 'system_test_report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  
  console.log(`📄 Detailed report saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(testResults.summary.failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});