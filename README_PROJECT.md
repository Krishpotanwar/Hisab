# Hisaab - Split Expenses Easily

> A modern, mobile-first expense splitting app for friends and groups. Built with React, TypeScript, and Supabase.

## ✨ Features

### Core Functionality
- 👥 **Create Groups**: Organize expenses with multiple people
- 💸 **Split Expenses**: Track who paid and who owes
- 👫 **Friend Management**: Add friends and split bills with them
- 📊 **Analytics**: Visual breakdown of spending patterns
- 🧮 **Smart Settlement**: Simplify complex debt chains
- 📱 **OCR Receipts**: Extract data from receipt photos (Tesseract.js)

### Mobile & PWA
- 📱 **Progressive Web App**: Install on home screen
- 🔴 **Offline Mode**: Works without internet
- ⚡ **Fast**: Service Worker for instant loading
- 🎨 **Responsive**: Perfect on mobile, tablet, desktop
- 🌙 **Dark Mode**: Easy on the eyes

### Tech Features
- ✅ **Zero Errors**: All ESLint errors fixed
- 🔒 **Type Safe**: Full TypeScript coverage
- 🚀 **Optimized**: Bundle splitting & minification
- 🔐 **Secure**: Supabase auth & RLS policies
- 💾 **Real-time**: Supabase subscriptions ready

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Supabase account (free tier)

### Installation

```bash
# Clone and install
git clone <repo>
cd hisaab
npm install

# Setup environment
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Run development server
npm run dev

# Open http://localhost:8080
```

### Build for Production

```bash
# Build
npm run build

# Preview production build locally
npm run preview

# Deploy (see DEPLOYMENT.md)
vercel --prod
```

---

## 📁 Project Structure

```
hisaab/
├── src/
│   ├── pages/              # Full-page components
│   │   ├── Dashboard.tsx    # Main dashboard
│   │   ├── GroupDetail.tsx  # Group expense view
│   │   ├── Analytics.tsx    # Spending analytics
│   │   └── Auth.tsx         # Login/signup
│   ├── components/          # Reusable components
│   │   ├── ui/              # Shadcn UI components (Radix-based)
│   │   └── [others]         # App-specific components
│   ├── hooks/               # Custom React hooks
│   │   ├── useGroups.ts     # Group management
│   │   ├── useExpenses.ts   # Expense logic
│   │   ├── useFriends.ts    # Friend connections
│   │   └── [others]         # Analytics, receipts, etc.
│   ├── integrations/        # External services
│   │   └── supabase/        # Supabase client & types
│   ├── lib/                 # Utilities
│   │   ├── auth.tsx         # Auth context
│   │   └── utils.ts         # Helper functions
│   ├── types/               # Type definitions
│   │   └── db.ts            # Database types
│   ├── config/              # Configuration
│   │   └── viewport.ts      # Mobile config
│   ├── App.tsx              # Main component
│   └── main.tsx             # Entry point
├── public/                  # Static assets
│   ├── manifest.json        # PWA manifest
│   └── sw.js                # Service Worker
├── vite.config.ts           # Build config
├── tailwind.config.ts       # Tailwind CSS
├── tsconfig.json            # TypeScript config
├── package.json             # Dependencies
└── DEPLOYMENT.md            # Deployment guide
```

---

## 🛠️ Available Scripts

```bash
# Development
npm run dev          # Start dev server on localhost:8080

# Production
npm run build        # Build for production to dist/
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
```

---

## 📱 Mobile & PWA

### Install as App
1. **iOS**: Safari > Share > Add to Home Screen
2. **Android**: Chrome > Menu > "Install app" or "Add to home screen"
3. **Desktop**: Can be "installed" via browser prompt

### Offline Features
- ✅ Loads instantly from Service Worker cache
- ✅ Works completely offline
- ✅ Data syncs when back online
- ✅ Automatic background sync with Supabase

### Performance
- Bundle: ~700KB (gzipped: ~230KB)
- Lighthouse Score: 90+
- Time to Interactive: <1s

---

## 🔐 Authentication & Data

### Auth
- Supabase Auth with email/password
- Row-Level Security (RLS) policies
- Session persistence
- Automatic refresh tokens

### Data Storage
- **Groups**: Team expense tracking
- **Expenses**: Individual transactions
- **Expense Splits**: Who owes what
- **Settlements**: Debt payments
- **Friends**: User connections
- **Profiles**: User info & avatars

### RLS Policies
- Users can only see their own data
- Group members see group expenses
- Friends can't modify each other's records
- Admin-only operations protected

---

## 🐛 Code Quality

### Current Status
✅ **0 ESLint Errors**
✅ **TypeScript strict mode passing**
✅ **8 ESLint warnings** (UI component exports - low priority)

### Types Fixed
- Replaced all `any` types with specific types (`ActivityRecord`, `SplitWithExpense`, `ProfileRecord`)
- Replaced `@ts-ignore` with `@ts-expect-error` with descriptions
- Full type safety on Supabase queries

---

## 🎯 Optimization

### Bundle Splitting
- **vendor.js**: React, React-DOM, React-Router (~52KB gzip)
- **supabase.js**: Supabase client (~44KB gzip)
- **index.js**: App code & UI components (~120KB gzip)

### Performance Features
- Dynamic imports ready
- CSS minification & extraction
- Asset caching with Service Worker
- Gzip compression on server
- Image optimization ready

---

## 🚀 Deployment

### Recommended: Vercel
```bash
vercel --prod
```

### Also Supports
- Netlify: `netlify deploy --prod --dir=dist`
- Firebase: `firebase deploy`
- AWS Amplify: `amplify publish`
- Self-hosted: Copy `dist/` to web server

**Full guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 📚 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **State** | React Hooks, React Query |
| **UI** | Tailwind CSS, Radix UI, Lucide Icons |
| **Backend** | Supabase (PostgreSQL + Auth) |
| **Forms** | React Hook Form, Zod validation |
| **Routing** | React Router v6 |
| **Analytics** | Recharts |
| **OCR** | Tesseract.js |
| **Animations** | Framer Motion |
| **Styling** | Tailwind CSS + CSS-in-JS (styled with classnames) |
| **Build** | Vite 5 + SWC |

---

## 🔄 Git Workflow

```bash
# Feature branch
git checkout -b feature/add-expense
git add .
git commit -m "Add expense feature"
git push origin feature/add-expense

# Create PR, review, merge
git checkout main
git pull origin main

# Deploy
npm run build
vercel --prod
```

---

## 📦 Dependencies

### Core
- `react` (18.3.1)
- `react-router-dom` (6.30.1)
- `@supabase/supabase-js` (2.90.1)

### UI
- `tailwindcss` (3.4.17)
- `@radix-ui/*` (latest)
- `lucide-react` (0.462.0)
- `class-variance-authority` (0.7.1)

### Forms & Validation
- `react-hook-form` (7.61.1)
- `zod` (3.25.76)

### Features
- `recharts` (2.15.4)
- `tesseract.js` (7.0.0)
- `framer-motion` (12.26.1)
- `sonner` (1.7.4) - Toasts
- `next-themes` (0.3.0) - Dark mode

---

## 🎨 Customization

### Colors & Theme
Edit `tailwind.config.ts` for brand colors

### Icons
Replace `lucide-react` icons with your preference

### Fonts
Tailwind defaults, or add Google Fonts in `index.html`

### Logo/Branding
Update `Hisaab` text in Dashboard header and favicon in public/

---

## 📖 Component Examples

### Adding an Expense
```tsx
const { createExpense } = useExpenses(groupId);

await createExpense(
  'Dinner',
  1200,
  'food',
  [
    { user_id: user1.id, amount: 400 },
    { user_id: user2.id, amount: 400 },
    { user_id: user3.id, amount: 400 },
  ]
);
```

### Getting Group Balances
```tsx
const { getBalances } = useExpenses(groupId);
const balances = await getBalances();
// [{ user_id: '...', balance: 500 }, ...]
```

---

## 🆘 Troubleshooting

### "Module not found" error
```bash
npm install
npm run build
```

### Supabase connection fails
- Check `.env` file
- Verify API keys in Supabase dashboard
- Check network tab in DevTools

### PWA not installing
- Ensure HTTPS (required for PWA)
- Check browser DevTools > Application > Manifest
- Clear site data and try again

### TypeScript errors
```bash
npx tsc --noEmit
```

---

## 📝 License

MIT - See [LICENSE](./LICENSE)

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` to fix issues
5. Push and create a PR

---

## 📞 Support

For deployment help, see [DEPLOYMENT.md](./DEPLOYMENT.md)

For code questions, check the source or open an issue.

---

**Made with ❤️ for splitting expenses fairly**

🚀 Ready to deploy? Follow [DEPLOYMENT.md](./DEPLOYMENT.md)
