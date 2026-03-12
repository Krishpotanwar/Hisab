<div align="center">

# 🪙 HisaabKitaab

### Group Expense Splitting — Built for India

[![Live Demo](https://img.shields.io/badge/Live_Demo-hisab--rust.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://hisab-rust.vercel.app)
[![React](https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## What is HisaabKitaab?

HisaabKitaab is a full-stack Progressive Web App (PWA) for tracking shared expenses across friend groups, roommates, and trips. It shows real-time balances, suggests who owes whom, and supports UPI-linked settlements — designed from the ground up for Indian users.

No app install needed. Works on any phone browser. Dark mode included.

---

## ✨ Features

- **Group expense management** — Create groups, add expenses, and see live balances showing exactly who owes what to whom
- **OCR receipt scanning** — Take a photo of any bill and auto-fill the amount using client-side OCR (Tesseract.js) — zero external API cost
- **Two-party settlement confirmation** — When someone marks a payment as done, the recipient must confirm receipt before the balance updates
- **UPI deep link payments** — "Pay now" opens GPay / PhonePe / Paytm with the payee's details pre-filled; money goes directly to the right person
- **Razorpay "Buy me a chai"** — Support button for the developer built into the app
- **Invite system** — Invite members by email even before they've signed up; their splits are pre-allocated
- **PWA support** — Installable, offline-ready, with push notifications
- **Full dark / light mode** with system detection

---

## 🗄️ Database Schema

7 core tables: `profiles` · `groups` · `group_members` · `expenses` · `expense_splits` · `settlements` · `pending_settlements`

All tables use Row Level Security (RLS) — users can only access data from groups they belong to.

---

## ⚙️ Local Setup

### Prerequisites
- Node.js 18+
- A Supabase project ([create one free](https://supabase.com))
- A Razorpay account (optional — only needed for payment features)

### 1. Clone the repo

```bash
git clone https://github.com/Krishpotanwar/Hisab.git
cd Hisab
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set environment variables

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
```

### 4. Run database migrations

Paste the SQL files from `supabase/migrations/` into your Supabase SQL Editor and run them in order.

### 5. Start the dev server

```bash
npm run dev
```

App runs at `http://localhost:8080`

---

## 🏗️ How It Works

```
Browser (React + Vite)
  │
  ├── Supabase (PostgreSQL + RLS)    — auth, expenses, groups, settlements
  ├── Supabase Edge Functions        — Razorpay order creation & verification
  ├── Tesseract.js (client-side)     — receipt OCR, no backend needed
  └── Vercel                         — frontend hosting + CDN
```

When a user adds an expense, it's split across selected members according to equal, custom, or percentage rules. Balances are computed on the fly from all expenses and settlements. When settling up, a UPI deep link opens the payee's UPI app directly — no intermediary.

---

## 🗺️ Roadmap

- [ ] Native mobile app (React Native / Capacitor)
- [ ] Recurring expenses (monthly rent, subscriptions)
- [ ] Multi-currency support with live exchange rates
- [ ] Export to CSV / PDF
- [ ] Group chat per expense
- [ ] Spending analytics and charts

---

## 📜 License

MIT © [Krish Potanwar](https://github.com/Krishpotanwar)
