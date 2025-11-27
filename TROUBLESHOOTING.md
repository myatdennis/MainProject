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

### SSL / TLS (ERR_SSL_PROTOCOL_ERROR)

If your production site returns `ERR_SSL_PROTOCOL_ERROR` or browsers refuse to connect securely, try these steps:

- Verify DNS and domain mapping:
  ```bash
  dig the-huddle.co
  nslookup the-huddle.co
  ```
- Confirm TLS handshake:
  ```bash
  openssl s_client -connect the-huddle.co:443 -servername the-huddle.co
  npm run diag:ssl -- the-huddle.co
  ```
- If using Cloudflare: set SSL/TLS mode to 'Full' or 'Full (strict)' and ensure the origin server has a valid certificate.
- If using Netlify/Vercel: Verify the site status in their dashboard and re-issue or re-provision the certificate if the domain was recently changed.
- If you want the server to enforce HTTPS automatically: set `ENFORCE_HTTPS=true` and `NODE_ENV=production`.

# Troubleshooting Guide

## Common Issues & Solutions

### 1. Port Already in Use (8888 or 5174)
- **Symptom:** Server fails to start, error `EADDRINUSE` or port busy.
- **Solution:**
  - Run `lsof -iTCP:8888 -sTCP:LISTEN -n -P` and `lsof -iTCP:5174 -sTCP:LISTEN -n -P` to find the process.
  - Kill the process with `kill -9 <PID>`.
  - Use `npm run start:server` or `npm run dev` again.

### 2. Module Not Found (e.g. @supabase/supabase-js)
- **Symptom:** Dynamic import failed, cannot resolve module.
- **Solution:**
  - Run `npm install` to ensure all dependencies are present.
  - If you just pulled new code, always run `npm install`.

### 3. Network Error / Connection Refused
- **Symptom:** Frontend cannot reach backend, login fails, ERR_NETWORK.
- **Solution:**
  - Make sure the backend server is running (`npm run start:server`).
  - Make sure the frontend dev server is running (`npm run dev`).
  - Check `.env` for correct API URLs.

### 4. Out of Memory / Exit Code 137
- **Symptom:** Server is killed unexpectedly, exit code 137.
- **Solution:**
  - Close unused applications to free up RAM.
  - Avoid running multiple heavy processes at once.
  - Restart your dev environment if needed.

### 5. General Best Practices
- Always run `npm install` after pulling new code or switching branches.
- Always check ports are free before starting servers.
- Restart both backend and frontend after changing `.env` or dependencies.

---

For persistent issues, check logs and consult this file. If you need more help, open an issue on GitHub or contact your team lead.
