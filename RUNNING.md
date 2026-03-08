# Hisaab - Running Frontend & Backend

## 🚀 Current Status

### ✅ Frontend (Vite + React)
**Status**: Running ✓
**URL**: http://localhost:8080
**Network**: 
- Local: http://localhost:8080
- Network: http://10.112.234.215:8080
- Also available on: 10.211.55.2:8080 and 10.37.129.2:8080

**Features**:
- Hot module reloading (HMR) enabled
- Fast refresh on code changes
- TypeScript compilation in real-time
- CSS minification and processing

**Development**:
```bash
npm run dev
```

To stop:
```bash
Ctrl+C in terminal
```

---

### ✅ Backend (Supabase)
**Status**: Configured locally
**Type**: Backend-as-a-Service (PostgreSQL + Auth)
**Environment**: 
- URL: http://127.0.0.1:54321
- Project ID: local

**Connection Details** (from .env):
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

**Available Features**:
- ✓ Authentication (email/password)
- ✓ PostgreSQL database with migrations
- ✓ Row-Level Security (RLS)
- ✓ Real-time subscriptions
- ✓ Storage (files, images)
- ✓ Edge Functions

**Database Migrations Applied**:
```
✓ expenses & splits tables
✓ groups & members
✓ settlements
✓ friends
✓ profiles with email & upi_id
✓ RLS policies
```

---

## 📝 How to Use

### 1. Access Frontend
```bash
# Open in browser
http://localhost:8080

# Features available:
✓ Authentication (signup/login)
✓ Create groups & friends
✓ Add expenses & split
✓ View analytics
✓ Dark mode toggle
✓ Offline mode (Service Worker)
```

### 2. Test Authentication
```bash
Email: test@example.com
Password: TestPassword123!

# Or signup new account through the app
```

### 3. Test Features
- Create a group with friends
- Add an expense
- Split between members
- Check balances & analytics
- View settlement suggestions

### 4. Monitor Backend
Backend requests are logged in browser DevTools:
```
DevTools > Network tab > XHR/Fetch
```

---

## 🔧 Available Commands

```bash
# Development
npm run dev              # Start Vite dev server

# Production build
npm run build            # Build for production
npm run preview          # Preview production build

# Code quality
npm run lint             # Run ESLint
```

---

## 🌐 Deployment Ready

### Frontend
```bash
npm run build            # Creates dist/ folder
vercel --prod           # Deploy to Vercel
```

### Backend (Supabase)
Already deployed to Supabase cloud. To use production:

1. Get production credentials from Supabase dashboard
2. Update `.env`:
   ```
   VITE_SUPABASE_URL=your_production_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_production_key
   ```
3. Deploy frontend

---

## 📱 Mobile Testing

### On Same Network
Access from mobile device:
```
http://10.112.234.215:8080
```

### PWA Install
- iOS: Safari > Share > Add to Home Screen
- Android: Chrome > Menu > "Install app"

### Offline Testing
- DevTools > Network > Set to "Offline"
- App continues to work with Service Worker cache

---

## 🐛 Troubleshooting

### Frontend not starting
```bash
# Clear cache
rm -rf node_modules
npm install
npm run dev
```

### Port 8080 already in use
```bash
# Find process using port
lsof -i :8080

# Kill the process
kill -9 <PID>

# Or use different port
npm run dev -- --port 3000
```

### Backend not connecting
- Check `.env` has Supabase credentials
- Verify Supabase URL is accessible
- Check browser DevTools for CORS errors

### Service Worker issues
```bash
# Clear cache
DevTools > Application > Clear storage > Clear site data
```

---

## 📊 Architecture

```
Frontend (React/Vite) ←→ Supabase (PostgreSQL + Auth)
    ↓                          ↓
localhost:8080         http://127.0.0.1:54321
    ↓                          ↓
- Components            - Authentication
- Pages                 - Database
- State (React Hooks)   - Real-time
- Forms & Validation    - File Storage
- PWA/Service Worker    - Edge Functions
```

---

## 🎯 Quick Start Summary

1. **Frontend is running** at http://localhost:8080 ✓
2. **Backend is configured** with local Supabase ✓
3. **Open browser** and start using Hisaab ✓
4. **Test offline mode** - App works without internet ✓
5. **Deploy when ready** - See DEPLOYMENT.md ✓

---

## 📞 Need Help?

- Frontend docs: README_PROJECT.md
- Deployment: DEPLOYMENT.md
- Status: PRODUCTION_READY.md

**Happy coding! 🚀**
