<div align="center">

# 🪙 HisaabKitaab

### _Split expenses. Settle debts. Stay friends._

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Visit_App-6366f1?style=for-the-badge)](https://hisab-5rhqpvyce-krishpotanwars-projects.vercel.app)
[![Built with React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel)](https://vercel.com)

> **HisaabKitaab** is the smart, India-first expense splitting app. Create groups, add shared expenses, track who owes what, and settle up via UPI — all in one beautifully simple app.

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 👥 **Group Expenses** | Create groups for trips, roommates, dinners, and more |
| ⚖️ **Smart Splits** | Split equally, by percentage, or custom amounts |
| 📊 **Balance Tracking** | Real-time balances showing who owes whom |
| 📷 **OCR Receipt Scan** | Scan any receipt with your camera — amount auto-filled instantly (no API key needed) |
| 💳 **UPI Settlements** | Settle debts directly via Razorpay UPI integration |
| 🔐 **Google Sign-In** | One-tap Google OAuth login |
| 🌙 **Dark Mode** | Full dark/light theme with system preference detection |
| 📱 **PWA Ready** | Installable on Android & iOS like a native app |
| ⚡ **Offline First** | Works without internet after first load |

---

## 🖥️ Screenshots

> _Dashboard · Group Detail · Add Expense · Receipt Scan_

<div align="center">
<img src="https://placehold.co/800x400/6366f1/white?text=HisaabKitaab+App+Preview" alt="App Preview" width="100%" />
</div>

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/Krishpotanwar/Hisab.git
cd Hisab

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Run database migrations
psql -h db.<your-ref>.supabase.co -U postgres -f supabase/combined_migrations_RUN_ONCE.sql

# 5. Start the dev server
npm run dev
```

App will be running at **http://localhost:5173**

---

## 🔧 Environment Variables

Copy `.env.example` → `.env.local` and fill in your values:

```env
# Supabase (required)
VITE_SUPABASE_URL=https://your-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...

# Razorpay UPI (optional)
VITE_RAZORPAY_KEY_ID=rzp_test_...
```

For Supabase Edge Functions, set these in **Supabase → Settings → Edge Functions Secrets**:

```env
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Animation** | Framer Motion |
| **Backend** | Supabase (Auth + PostgreSQL + Storage) |
| **Payments** | Razorpay UPI |
| **OCR** | Tesseract.js (fully client-side) |
| **Deployment** | Vercel |

---

## 🗄️ Database Schema

```
profiles       → user profiles (name, phone, avatar)
groups         → expense groups
group_members  → who's in each group
expenses       → individual expense records
expense_splits → how each expense is split
settlements    → UPI payment settlements
categories     → expense categories
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

MIT © [Krish Potanwar](https://github.com/Krishpotanwar)

---

<div align="center">

Made with ❤️ in India 🇮🇳

**[⭐ Star this repo](https://github.com/Krishpotanwar/Hisab)** if you found it useful!

</div>
