# HisaabKitaab (Merged Build)

India-first Splitwise-style expense sharing app built with React, TypeScript, Supabase, and Razorpay integration.

## Included from both source folders

- Core expense split flows from `Hisaab`
- PWA/service-worker and docs artifacts from `fresh-start-files-main...`
- OAuth-ready auth UX for Google, Apple, and X (Twitter provider in Supabase)
- Razorpay settlement flow scaffolding (order creation + payment verification + webhook endpoint)

## Quick start

```bash
npm install
npm run dev
```

## Required environment variables

Create `.env` from `.env.example`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_RAZORPAY_KEY_ID=...
```

For Supabase Edge Functions (set in Supabase secrets):

```bash
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Validation commands

```bash
npm run lint
npm run build
```
