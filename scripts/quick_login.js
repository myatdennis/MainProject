// Quick login script for browser console
// This creates a demo user session without backend authentication

const demoUser = {
  id: 'demo-user-123',
  email: 'demo@example.com',
  name: 'Demo User',
  role: 'learner',
  organizationId: 'demo-org'
};

// Store in localStorage (legacy format for compatibility)
localStorage.setItem('huddle_user', JSON.stringify(demoUser));

// Also set in sessionStorage for secureStorage compatibility
const encryptedData = btoa(JSON.stringify(demoUser)); // Simple base64 for demo
sessionStorage.setItem('auth_user', encryptedData);
sessionStorage.setItem('auth_tokens', btoa(JSON.stringify({
  accessToken: 'demo-token',
  refreshToken: 'demo-refresh',
  expiresAt: Date.now() + 86400000 // 24 hours from now
})));

console.log('✅ Demo user session created!');
console.log('📧 Email: demo@example.com');
console.log('🎭 Role: learner');
console.log('\n🔄 Refresh the page to access the LMS!');
