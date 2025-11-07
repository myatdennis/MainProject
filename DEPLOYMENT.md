## Deployment Guide

### Quick Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Set Environment Variables:**
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   vercel env add JWT_SECRET
   vercel env add VITE_API_BASE_URL
   ```

5. **Deploy to Production:**
   ```bash
   vercel --prod
   ```

### Connect Custom Domain

1. **In Vercel Dashboard:**
   - Go to your project → Settings → Domains
   - Click "Add Domain"
   - Enter your domain (e.g., `app.yourdomain.com`)
   - Follow DNS configuration instructions

2. **Update DNS Records:**
   - Add the CNAME or A record shown by Vercel
   - Wait for DNS propagation (5-60 minutes)

3. **Update Environment Variables:**
   ```bash
   vercel env add VITE_API_BASE_URL production
   # Enter: https://yourdomain.com
   
   vercel env add VITE_API_URL production
   # Enter: https://yourdomain.com/api
   ```

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

### Alternative: Railway

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Initialize:**
   ```bash
   railway init
   ```

4. **Set Environment Variables:**
   ```bash
   railway variables set VITE_SUPABASE_URL=your-value
   railway variables set JWT_SECRET=your-secret
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Add Custom Domain:**
   - Go to Railway dashboard
   - Settings → Domains
   - Add custom domain
   - Update DNS records as instructed

### Environment Variables Checklist

Production environment variables you need to set:

- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `JWT_SECRET` (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
- ✅ `VITE_API_BASE_URL` (your domain URL)
- ✅ `VITE_API_URL` (your domain URL + /api)
- ✅ `NODE_ENV=production`
- ✅ `PORT=8787` (or your hosting platform's default)

### SSL Certificate

Most platforms (Vercel, Railway, Netlify) provide automatic SSL certificates through Let's Encrypt. If using a custom server:

1. Use **Certbot** for free SSL:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

2. Or use **Cloudflare** for free SSL + CDN

### Build Commands

Make sure your hosting platform uses:
- **Build Command:** `npm run build`
- **Start Command:** `node server/index.js`
- **Install Command:** `npm install`
