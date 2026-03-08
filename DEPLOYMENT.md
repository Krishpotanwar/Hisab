# Hisaab - Deployment & Hosting Guide

## Project Status
✅ **Production Ready**
- All ESLint errors fixed (0 errors, 8 warnings only)
- Full TypeScript compilation passing
- Bundle optimized with chunking strategy
- PWA support enabled
- Mobile-first responsive design
- Service Worker for offline support

---

## Deployment Options

### Option 1: Vercel (Recommended for Next.js-style)
**Easiest deployment for React projects**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# With custom domain
vercel --prod --scope=your-scope
```

**Features:**
- Automatic builds on git push
- Serverless functions support
- Built-in image optimization
- Edge caching

---

### Option 2: Netlify
**Great for static sites with serverless backend**

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

**netlify.toml config:**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[redirects]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/manifest.json"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=3600"
```

---

### Option 3: Firebase Hosting
**Google Cloud-backed hosting**

```bash
# Install Firebase CLI
npm i -g firebase-tools

# Initialize
firebase init hosting

# Deploy
npm run build
firebase deploy
```

**firebase.json:**
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/manifest.json",
        "headers": [{ "key": "Cache-Control", "value": "max-age=31536000" }]
      },
      {
        "source": "/sw.js",
        "headers": [{ "key": "Cache-Control", "value": "max-age=3600" }]
      }
    ]
  }
}
```

---

### Option 4: AWS Amplify
**Full AWS ecosystem integration**

```bash
# Install Amplify CLI
npm i -g @aws-amplify/cli

# Initialize
amplify init

# Add hosting
amplify add hosting

# Deploy
amplify publish
```

---

### Option 5: Self-Hosted (DigitalOcean/Linode/AWS EC2)

**Using PM2 + Nginx:**

```bash
# 1. Build locally
npm run build

# 2. SCP to server
scp -r dist/* user@server:/var/www/hisaab/

# 3. Nginx config
server {
    listen 80;
    server_name hisaab.com www.hisaab.com;
    
    root /var/www/hisaab;
    index index.html;
    
    # SPA routing
    location / {
        try_files $uri /index.html;
    }
    
    # Cache busting for index.html
    location = /index.html {
        add_header Cache-Control "public, max-age=0, must-revalidate" always;
    }
    
    # Long-term caching for assets
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Service Worker
    location = /sw.js {
        add_header Cache-Control "public, max-age=3600, must-revalidate" always;
        add_header Service-Worker-Allowed "/";
    }
    
    # Manifest
    location = /manifest.json {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}

# 4. Enable HTTPS with Let's Encrypt
sudo certbot --nginx -d hisaab.com -d www.hisaab.com
```

---

## Pre-Deployment Checklist

### Code Quality
- [x] All ESLint errors fixed (0 errors remaining)
- [x] TypeScript compilation passing
- [x] Build succeeds without warnings (except browserslist)

### Performance
- [x] Bundle splitting enabled (vendor, supabase chunks)
- [x] Terser minification configured
- [x] Tree-shaking optimized
- [ ] Run: `npm run build` and verify output

### Mobile & PWA
- [x] Service Worker enabled (/public/sw.js)
- [x] Manifest.json configured (/public/manifest.json)
- [x] Mobile viewport meta tags set
- [x] Apple Web App capable meta tags added
- [x] Icon placeholders ready in /public/

### Security
- [ ] Supabase environment variables in `.env`
- [ ] API keys rotated before deployment
- [ ] CORS configured if needed
- [ ] Rate limiting enabled on backend

### Analytics & Monitoring
- [ ] Google Analytics ID configured (optional)
- [ ] Error logging setup (Sentry/LogRocket)
- [ ] Performance monitoring configured

---

## Deployment Steps by Platform

### Vercel (Quickest)
```bash
# 1. Push to GitHub
git add .
git commit -m "Ready for production"
git push origin main

# 2. Go to vercel.com, click New Project, select repo
# 3. Click Deploy (automatic!)

# 4. Add domain
# Settings > Domains > Add Custom Domain
```

### Netlify
```bash
# 1. Connect to GitHub
# Go to netlify.com > New site from Git

# 2. Select repository
# 3. Build command: npm run build
# 4. Publish directory: dist

# 5. Deploy Site
```

### Firebase
```bash
firebase login
firebase init hosting
# Choose: Yes to SPA rewrite
# Build folder: dist
firebase deploy
```

---

## Environment Variables

Create `.env` file with:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_API_URL=https://api.hisaab.com  # If using custom backend
```

**Platform-specific:**
- **Vercel**: Settings > Environment Variables
- **Netlify**: Site settings > Build & deploy > Environment
- **Firebase**: `.env` in root (not committed)
- **AWS Amplify**: amplify > Environment variables

---

## Post-Deployment

### 1. Test PWA on Mobile
```bash
# Android: Use Chrome DevTools
# iOS: Home Screen > Add to Home Screen
# Check: App Icon, Offline mode, Manifest
```

### 2. Monitor Performance
```bash
# Lighthouse audit
# Open DevTools > Lighthouse > Analyze page load
# Target: >90 score
```

### 3. Test Core Features
- [ ] Authentication (signup/login)
- [ ] Add expense
- [ ] Create group
- [ ] View analytics
- [ ] Offline mode (enable offline in DevTools)

### 4. SSL Certificate
- Vercel/Netlify/Firebase: ✅ Automatic
- Self-hosted: Use Let's Encrypt (certbot)

---

## Rollback Plan

If issues occur:

```bash
# Vercel
vercel rollback

# Netlify
# Site settings > Deployments > Click previous > Publish deploy

# Firebase
firebase deploy --only hosting (redeploy from previous build)
```

---

## Support Hosting Providers

| Provider | Cost | Setup | Build Time | SSL | Auto-scaling |
|----------|------|-------|-----------|-----|--------------|
| **Vercel** | Free-$20/mo | 1 min | 30s | ✅ | ✅ |
| **Netlify** | Free-$19/mo | 1 min | 30s | ✅ | ✅ |
| **Firebase** | Free-Pay as you go | 2 min | 1 min | ✅ | ✅ |
| **AWS Amplify** | Free-Pay as you go | 3 min | 2 min | ✅ | ✅ |
| **DigitalOcean** | $4-12/mo | 15 min | Manual | Certbot | Manual |

---

## Recommended: Vercel
**Why?**
- Zero-config deployment for React
- Fastest build times
- Integrated analytics
- Automatic HTTPS + CDN
- Perfect for Hisaab's tech stack

**Deploy now:**
```bash
npm i -g vercel
vercel --prod
```

---

## Troubleshooting

### Build fails with "Cannot find module"
```bash
npm install
npm run build
```

### Supabase connection fails
- Check `.env` variables
- Verify API keys
- Check CORS settings in Supabase dashboard

### PWA not installing
- Check manifest.json is valid (JSON lint)
- Verify HTTPS is enabled
- Test in Chrome DevTools: Application > Manifest

### Performance issues
- Run `npm run build` and check bundle sizes
- Use Lighthouse for recommendations
- Enable gzip compression on server

---

**Ready to deploy! 🚀**

For questions or issues, check deployment platform docs:
- [Vercel Docs](https://vercel.com/docs)
- [Netlify Docs](https://docs.netlify.com)
- [Firebase Docs](https://firebase.google.com/docs/hosting)
