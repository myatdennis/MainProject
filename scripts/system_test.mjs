#!/usr/bin/env node

/**
 * Comprehensive System Test & Validation Script
 * Tests Admin Portal, Client Portal, and synchronization features
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const TIMEOUT = 10000;

// Test results storage
const results = {
  timestamp: new Date().toISOString(),
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  },
  tests: {}
};

async function runTest(name, testFunction) {
  results.summary.total++;
  console.log(`\n🧪 Running test: ${name}`);
  
  try {
    const result = await testFunction();
    if (result.success) {
      results.summary.passed++;
      console.log(`✅ ${name}: PASSED`);
    } else {
      results.summary.failed++;
      console.log(`❌ ${name}: FAILED - ${result.error}`);
      results.summary.errors.push({ test: name, error: result.error });
    }
    
    results.tests[name] = result;
  } catch (error) {
    results.summary.failed++;
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    results.summary.errors.push({ test: name, error: error.message });
    results.tests[name] = { success: false, error: error.message };
  }
}

async function testHomePage(page) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  
  const title = await page.title();
  const hasNavigation = await page.locator('nav').count() > 0;
  const hasLogo = await page.locator('[data-testid="logo"], .logo, [alt*="logo"]').count() > 0;
  
  return {
    success: title.length > 0 && hasNavigation,
    details: { title, hasNavigation, hasLogo },
    error: !title ? 'Page title missing' : !hasNavigation ? 'Navigation missing' : null
  };
}

async function testLMSPortal(page) {
  // Test LMS login page
  await page.goto(`${BASE_URL}/lms/login`);
  await page.waitForLoadState('networkidle');
  
  const hasLoginForm = await page.locator('form, [data-testid="login-form"]').count() > 0;
  const hasEmailField = await page.locator('input[type="email"], input[name*="email"]').count() > 0;
  const hasPasswordField = await page.locator('input[type="password"], input[name*="password"]').count() > 0;
  
  if (hasLoginForm && hasEmailField && hasPasswordField) {
    // Try demo login
    await page.fill('input[type="email"], input[name*="email"]', 'user@pacificcoast.edu');
    await page.fill('input[type="password"], input[name*="password"]', 'user123');
    await page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
    
    // Wait for potential redirect
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    const isLoggedIn = currentUrl.includes('/lms/dashboard') || currentUrl.includes('/lms/courses');
    
    return {
      success: isLoggedIn,
      details: { hasLoginForm, hasEmailField, hasPasswordField, currentUrl },
      error: !isLoggedIn ? 'Login failed or redirect not working' : null
    };
  }
  
  return {
    success: false,
    details: { hasLoginForm, hasEmailField, hasPasswordField },
    error: 'Login form elements missing'
  };
}

async function testLMSDashboard(page) {
  await page.goto(`${BASE_URL}/lms/dashboard`);
  await page.waitForLoadState('networkidle');
  
  const hasHeader = await page.locator('h1, .dashboard-title').count() > 0;
  const hasCourseCards = await page.locator('[data-testid="course-card"], .course-card, .bg-white').count() > 0;
  const hasNavigation = await page.locator('nav, .sidebar').count() > 0;
  
  // Check for console errors
  const consoleMessages = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleMessages.push(msg.text());
    }
  });
  
  return {
    success: hasHeader && hasNavigation,
    details: { hasHeader, hasCourseCards, hasNavigation, consoleErrors: consoleMessages },
    error: !hasHeader ? 'Dashboard header missing' : !hasNavigation ? 'Navigation missing' : null
  };
}

async function testLMSCourses(page) {
  await page.goto(`${BASE_URL}/lms/courses`);
  await page.waitForLoadState('networkidle');
  
  const hasCoursesTitle = await page.locator('h1:has-text("Courses"), h1:has-text("My Courses")').count() > 0;
  const hasCourseList = await page.locator('.course-card, [data-testid="course"], .bg-white').count() > 0;
  const hasSearchFilter = await page.locator('input[type="search"], input[placeholder*="search"]').count() > 0;
  
  return {
    success: hasCoursesTitle && hasCourseList,
    details: { hasCoursesTitle, hasCourseList, hasSearchFilter },
    error: !hasCoursesTitle ? 'Courses title missing' : !hasCourseList ? 'Course list missing' : null
  };
}

async function testCourseModule(page) {
  // Test accessing a course module
  const moduleUrls = [
    `${BASE_URL}/lms/module/foundations`,
    `${BASE_URL}/lms/module/bias`,
    `${BASE_URL}/lms/module/empathy`
  ];
  
  for (const url of moduleUrls) {
    try {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      const hasLessonContent = await page.locator('.lesson-content, .module-content, h1').count() > 0;
      const hasProgressBar = await page.locator('.progress-bar, .progress', '[role="progressbar"]').count() > 0;
      const hasNavigation = await page.locator('.lesson-nav, button:has-text("Next"), button:has-text("Previous")').count() > 0;
      
      if (hasLessonContent) {
        // Test refresh button functionality
        const hasRefreshButton = await page.locator('button:has-text("Refresh"), button[title*="refresh" i]').count() > 0;
        
        if (hasRefreshButton) {
          await page.click('button:has-text("Refresh"), button[title*="refresh" i]');
          await page.waitForTimeout(1000);
        }
        
        return {
          success: hasLessonContent && hasProgressBar,
          details: { hasLessonContent, hasProgressBar, hasNavigation, hasRefreshButton, url },
          error: !hasProgressBar ? 'Progress bar missing' : null
        };
      }
    } catch (error) {
      continue; // Try next URL
    }
  }
  
  return {
    success: false,
    details: { testedUrls: moduleUrls },
    error: 'No accessible course modules found'
  };
}

async function testAdminPortal(page) {
  // Test admin login page
  await page.goto(`${BASE_URL}/admin/login`);
  await page.waitForLoadState('networkidle');
  
  const hasLoginForm = await page.locator('form, [data-testid="admin-login"]').count() > 0;
  const hasEmailField = await page.locator('input[type="email"], input[name*="email"]').count() > 0;
  
  if (hasLoginForm && hasEmailField) {
    // Try demo admin login
    await page.fill('input[type="email"], input[name*="email"]', 'admin@thehuddleco.com');
    await page.fill('input[type="password"], input[name*="password"]', 'admin123');
    await page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
    
    // Wait for redirect and loading
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    const isLoggedIn = currentUrl.includes('/admin/dashboard');
    
    return {
      success: isLoggedIn,
      details: { hasLoginForm, hasEmailField, currentUrl },
      error: !isLoggedIn ? 'Admin login failed - check authentication' : null
    };
  }
  
  return {
    success: false,
    details: { hasLoginForm, hasEmailField },
    error: 'Admin login form missing'
  };
}

async function testAdminDashboard(page) {
  await page.goto(`${BASE_URL}/admin/dashboard`);
  await page.waitForLoadState('networkidle');
  
  // Wait for auth loading
  await page.waitForTimeout(2000);
  
  const hasAdminTitle = await page.locator('h1:has-text("Admin"), h1:has-text("Dashboard")').count() > 0;
  const hasStatsCards = await page.locator('.stats-card, .bg-white', '.stat').count() > 0;
  const hasSidebar = await page.locator('.sidebar, nav').count() > 0;
  
  // Check if redirected to login (auth failure)
  const currentUrl = page.url();
  const redirectedToLogin = currentUrl.includes('/admin/login');
  
  return {
    success: hasAdminTitle && !redirectedToLogin,
    details: { hasAdminTitle, hasStatsCards, hasSidebar, currentUrl, redirectedToLogin },
    error: redirectedToLogin ? 'Redirected to login - authentication failed' : !hasAdminTitle ? 'Admin dashboard not loading' : null
  };
}

async function testSyncFunctionality(page) {
  // Test if sync service is working
  await page.goto(`${BASE_URL}/lms/courses`);
  await page.waitForLoadState('networkidle');
  
  // Check console for sync service messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(msg.text());
  });
  
  // Wait for sync service to initialize
  await page.waitForTimeout(2000);
  
  const syncInitialized = consoleMessages.some(msg => 
    msg.includes('sync') || msg.includes('Supabase') || msg.includes('real-time')
  );
  
  // Test manual refresh on a module page if available
  await page.goto(`${BASE_URL}/lms/module/foundations`);
  await page.waitForLoadState('networkidle');
  
  const hasRefreshButton = await page.locator('button:has-text("Refresh")').count() > 0;
  if (hasRefreshButton) {
    await page.click('button:has-text("Refresh")');
    await page.waitForTimeout(1000);
    
    const refreshWorked = await page.locator('.notification, .toast, .success').count() > 0;
    
    return {
      success: hasRefreshButton && (refreshWorked || syncInitialized),
      details: { hasRefreshButton, refreshWorked, syncInitialized, consoleMessages: consoleMessages.slice(-5) },
      error: !hasRefreshButton ? 'Refresh button not found' : null
    };
  }
  
  return {
    success: syncInitialized,
    details: { syncInitialized, consoleMessages: consoleMessages.slice(-5) },
    error: 'Could not test refresh functionality'
  };
}

async function main() {
  console.log('🚀 Starting Comprehensive System Test Suite');
  console.log(`Testing: ${BASE_URL}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Set viewport for consistent testing
  await page.setViewportSize({ width: 1280, height: 720 });
  
  try {
    // Run all tests
    await runTest('Homepage Load', () => testHomePage(page));
    await runTest('LMS Portal Access', () => testLMSPortal(page));
    await runTest('LMS Dashboard', () => testLMSDashboard(page));
    await runTest('LMS Courses Page', () => testLMSCourses(page));
    await runTest('Course Module Access', () => testCourseModule(page));
    await runTest('Admin Portal Access', () => testAdminPortal(page));
    await runTest('Admin Dashboard', () => testAdminDashboard(page));
    await runTest('Sync Functionality', () => testSyncFunctionality(page));
    
  } finally {
    await browser.close();
  }
  
  // Generate report
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('========================');
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.summary.passed / results.summary.total) * 100)}%`);
  
  if (results.summary.errors.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    results.summary.errors.forEach(({ test, error }) => {
      console.log(`   • ${test}: ${error}`);
    });
  }
  
  // Save detailed report
  const reportPath = path.join(process.cwd(), 'tmp', 'system_test_report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log(`\n📄 Detailed report saved: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(results.summary.failed > 0 ? 1 : 0);
}

main().catch(console.error);