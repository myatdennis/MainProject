# Blank Page Troubleshooting Guide

If you're seeing a blank page when running the application, follow these steps:

## Quick Fixes

### 1. Clear Service Worker Cache

Visit: **http://localhost:5174/unregister-sw.html**

This diagnostic page will:
- Show all registered service workers
- Allow you to unregister them
- Clear all browser caches
- Provide detailed status information

After clearing, refresh the main app.

### 2. Manual Browser Cache Clear

1. Open DevTools (F12 or Cmd+Option+I)
2. Go to **Application** tab
3. Click **Clear storage** in the left sidebar
4. Check all boxes
5. Click **Clear site data**
6. Refresh the page

### 3. Check Browser Console

1. Open DevTools (F12)
2. Go to **Console** tab
3. Look for red error messages
4. Share any errors you see

## Common Issues

### Service Worker Caching Old Content

**Symptoms:** Blank page, old version showing, changes not appearing

**Solution:**
```bash
# Visit the diagnostic page
open http://localhost:5174/unregister-sw.html

# Or manually in DevTools:
# Application → Service Workers → Unregister
# Application → Storage → Clear site data
```

### Environment Variables Missing

**Symptoms:** Auth not working, Supabase errors

**Solution:** The app works in demo mode without Supabase. If you want to use Supabase:

1. Create `.env` file:
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

2. Restart dev server:
```bash
npm run dev
```

### CSS Not Loading

**Symptoms:** Unstyled content, broken layout

**Solution:**
```bash
# Rebuild CSS
npm run build

# Restart dev server
npm run dev
```

### JavaScript Bundle Error

**Symptoms:** Blank page with console errors

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Restart dev server
npm run dev
```

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run E2E tests
npm run test:e2e
```

## Getting Console Errors

If you need help, please provide:

1. Browser console errors (F12 → Console tab)
2. Network tab errors (F12 → Network tab)
3. Browser and OS version
4. Steps to reproduce

## Demo Mode

The application is designed to work without a database in demo mode:

- **Demo Admin:** admin@thehuddleco.com / admin123
- **Demo LMS User:** user@pacificcoast.edu / user123

All features work locally with in-memory storage.

## Still Having Issues?

1. Try a different browser (Chrome, Firefox, Safari)
2. Try incognito/private mode
3. Check for browser extensions that might interfere
4. Ensure no firewall/antivirus is blocking localhost
