# HisaabKitaab — Full Code Audit Report
**Date:** March 2026  
**Auditor:** Claude (Anthropic)  
**Repo:** https://github.com/Krishpotanwar/Hisab  

---

## 🔴 CRITICAL — Fix Immediately

---

### 1. `.env.production` is committed to a PUBLIC GitHub repo
**File:** `.env.production`  
**Severity:** CRITICAL (Security Breach)

Your real Supabase URL and anon key are sitting in a public repo for anyone to read:
```
VITE_SUPABASE_URL="https://afeidgnwgxvvnrztqnbx.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJ..."
```

**Impact:** Anyone can make authenticated requests to your Supabase project, read/write your database, and impersonate users.

**Fix:**
1. Add `.env.production` to `.gitignore` immediately:
   ```
   .env.production
   .env.local
   .env*.local
   ```
2. Remove it from git history:
   ```bash
   git rm --cached .env.production
   git commit -m "remove env from tracking"
   git push
   ```
3. Rotate your Supabase API keys in the Supabase dashboard (Settings → API → Regenerate).
4. Set env vars in Vercel dashboard instead (Settings → Environment Variables).

---

### 2. Theme System Conflict — Profile page theme toggle broken
**Files:** `src/pages/Profile.tsx`, `src/components/ThemeToggle.tsx`, `src/App.tsx`  
**Severity:** CRITICAL (UI fully broken in Profile)

`Profile.tsx` imports `useTheme` from `next-themes`:
```tsx
import { useTheme } from 'next-themes';
```

But `App.tsx` has **no `<ThemeProvider>` wrapper** from next-themes. The app uses a completely separate custom `ThemeToggle` component that directly manipulates `document.documentElement.classList`.

**Result:** The appearance toggle in the Profile page either silently fails or throws an error. Two theme systems are fighting each other.

**Fix — Option A (Recommended): Remove next-themes from Profile, use the same approach as ThemeToggle:**
```tsx
// In Profile.tsx — replace useTheme import with:
import { useState, useEffect } from 'react';

// Replace the theme logic with:
const [theme, setTheme] = useState<'light' | 'dark'>(() =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light'
);
const toggleTheme = () => {
  const next = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.classList.toggle('dark', next === 'dark');
  localStorage.setItem('theme', next);
  setTheme(next);
};
```

**Fix — Option B: Add ThemeProvider to App.tsx and use next-themes everywhere:**
```tsx
// In App.tsx
import { ThemeProvider } from 'next-themes';

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    {/* rest of app */}
  </ThemeProvider>
);
```
Then delete `ThemeToggle.tsx` and use next-themes' `useTheme` everywhere.

---

## 🟠 HIGH — Significant Bugs

---

### 3. Duplicate `useExpenses` Hook in AddExpenseDialog
**File:** `src/components/AddExpenseDialog.tsx`  
**Severity:** HIGH (Performance + Logic Bug)

`AddExpenseDialog` calls `useExpenses(groupId)` at the top of the component. `GroupDetail.tsx` already calls `useExpenses(id)` for the same group. This creates **two independent hook instances** that both fetch expenses on mount — double the Supabase queries, and the dialog's internal expense state is stale and unused.

**Fix:** Remove `useExpenses` from `AddExpenseDialog` and pass `createExpense` as a prop from `GroupDetail`:
```tsx
// In AddExpenseDialog.tsx — change props interface:
interface AddExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  createExpense: ReturnType<typeof useExpenses>['createExpense']; // pass from parent
}

// In GroupDetail.tsx — pass it down:
const { expenses, loading, getBalances, createExpense } = useExpenses(id || null);
<AddExpenseDialog createExpense={createExpense} ... />
```

---

### 4. N+1 Query Problem in Analytics
**File:** `src/hooks/useAnalytics.ts`  
**Severity:** HIGH (Performance)

For each group, the analytics hook fires 4 separate queries (members, expenses, splits, settlements). With 6 monthly queries on top, a user with 5 groups generates **~36 Supabase requests** every time Analytics opens.

Additionally the 6-month loop fires 6 separate `expenses` queries sequentially.

**Fix:** Use `Promise.all` to parallelize, and consolidate queries:
```typescript
// Run all group balance queries in parallel:
const results = await Promise.all(
  groupIds.map(gid => fetchGroupBalance(gid))
);

// Run all 6 monthly queries in parallel:
const monthlyResults = await Promise.all(
  monthRanges.map(({ from, to }) => fetchMonthlyExpenses(from, to))
);
```

---

### 5. Analytics Balance Calculation is Incorrect
**File:** `src/hooks/useAnalytics.ts`  
**Severity:** HIGH (Wrong Data Shown)

The per-group balance logic is broken:
```typescript
const net = -(theirBal); // This is wrong
```
This computes the negative of the OTHER person's group balance, not the net between you and them. The `amount` field computation further down is a tangled ternary that doesn't correctly reflect what you owe or are owed per person.

**Fix:** The correct net between user A and user B is simply their individual group balances. If `myBal > 0`, I am owed. If `myBal < 0`, I owe. The per-person breakdown should come from splits directly, not be inferred this way. Simplest correct approach:
```typescript
// In allBalances calculation — replace the push logic:
const myBal = bal[user.id] ?? 0;
// Each person's balance relative to the group is their own responsibility
// Just report MY balance in this group, not per-person breakdown
if (Math.abs(myBal) > 0.01) {
  allBalances.push({
    userId: gid, // use group as key
    name: groupNames[gid],
    groupName: groupNames[gid],
    amount: myBal,
  });
}
```

---

### 6. `createGroup` Has No Transaction — Orphan Group Risk
**File:** `src/hooks/useGroups.ts`  
**Severity:** HIGH (Data Integrity)

```typescript
const { data: groupData } = await supabase.from('groups').insert({...}).select().single();
// ↑ if this succeeds but ↓ this fails → orphaned group with no members
const { error: memberError } = await supabase.from('group_members').insert({...});
```

If the member insert fails, a group exists in the DB with no members. The creator can never access it via the UI.

**Fix:** Use a Supabase edge function with a database transaction, OR use Postgres's RPC to combine the two inserts atomically. Minimum fix:
```typescript
if (memberError) {
  // Rollback: delete the group we just created
  await supabase.from('groups').delete().eq('id', groupData.id);
  return { error: memberError };
}
```

---

### 7. Floating-Point Split Amounts
**File:** `src/components/AddExpenseDialog.tsx`  
**Severity:** HIGH (Wrong Money Math)

```typescript
const splitAmount = amountNum / selectedMembers.length;
// ₹100 ÷ 3 = 33.333333... stored in DB
```

Three people splitting ₹100 gets ₹33.33 each = ₹99.99 total — 1 paise disappears. Over time, balance calculations will drift.

**Fix:** Round to 2 decimal places and assign the remainder to the first member (the payer):
```typescript
const baseSplit = Math.floor((amountNum / selectedMembers.length) * 100) / 100;
const remainder = Math.round((amountNum - baseSplit * selectedMembers.length) * 100) / 100;

const splits = selectedMembers.map((userId, index) => ({
  user_id: userId,
  amount: index === 0 ? baseSplit + remainder : baseSplit,
}));
```

---

### 8. `setLoading(false)` After Navigation in Auth
**File:** `src/pages/Auth.tsx`  
**Severity:** HIGH (React Warning + Potential Crash)

```typescript
const { error } = await signIn(email, password);
if (error) toast.error(...)
else navigate('/', { replace: true });  // component unmounts here
// ...
setLoading(false);  // ← setting state on unmounted component
```

**Fix:** Return early after navigation:
```typescript
const { error } = await signIn(email, password);
if (error) {
  toast.error(friendlyAuthError(error.message));
  setLoading(false);
} else {
  navigate('/', { replace: true });
  // Don't set loading — component is gone
}
```

---

### 9. Wasted Profile Fetch in `addMemberByEmail`
**File:** `src/hooks/useGroups.ts`  
**Severity:** HIGH (Security + Performance)

```typescript
// This fetches up to 100 user profiles and stores them in profileRows...
const { data: profileRows } = await supabase
  .from('profiles')
  .select('id, full_name')
  .limit(100);
// ...but profileRows is NEVER used. The variable is dead code.
```

This leaks up to 100 user IDs and names on every invite action with zero benefit.

**Fix:** Delete these 5 lines entirely.

---

## 🟡 MEDIUM — UI/UX Issues

---

### 10. No Protected Route Guard on Authenticated Pages
**Files:** `src/pages/Analytics.tsx`, `src/pages/Notifications.tsx`, `src/pages/Profile.tsx`

Only `Index.tsx` has auth-gating logic. If a user directly navigates to `/analytics` or `/profile` without being logged in, they'll see the page content briefly (potentially causing errors fetching data) before any redirect.

**Fix:** Create a `ProtectedRoute` wrapper:
```tsx
// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { SplashScreen } from './SplashScreen';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

// In App.tsx, wrap all protected routes:
<Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
```

---

### 11. Dead State Variable in Dashboard
**File:** `src/pages/Dashboard.tsx`  
**Severity:** MEDIUM (Dead Code)

```typescript
const [showBell, setShowBell] = useState(false); // Never used anywhere
```

`showBell` is declared and initialized but `setShowBell` is never called and `showBell` is never read. Remove it.

---

### 12. No "Paid By" Selector in AddExpenseDialog
**File:** `src/components/AddExpenseDialog.tsx`  
**Severity:** MEDIUM (Missing Feature / Wrong Data)

You can only record expenses as paid by the logged-in user. If Rahul paid for dinner, you have to be Rahul to record it correctly. There's no "Who paid?" dropdown.

**Fix:** Add a member selector for `paidBy`:
```tsx
const [paidBy, setPaidBy] = useState<string>(user?.id ?? '');

// Add before the split selector:
<div>
  <Label>Paid by</Label>
  <div className="flex gap-2 flex-wrap mt-2">
    {members.map(m => (
      <button
        key={m.user_id}
        type="button"
        onClick={() => setPaidBy(m.user_id)}
        className={cn("px-3 py-1.5 rounded-full text-sm", paidBy === m.user_id ? 'bg-primary text-primary-foreground' : 'bg-muted')}
      >
        {m.full_name.split(' ')[0]}
      </button>
    ))}
  </div>
</div>

// In handleSubmit, pass paidBy:
await createExpense(description, amountNum, category, splits, undefined, undefined, paidBy);
```

---

### 13. No Date Picker in AddExpenseDialog
**File:** `src/components/AddExpenseDialog.tsx`  
**Severity:** MEDIUM (Missing Feature)

All expenses always default to today's date. Users can't add historical expenses (e.g. entering last week's restaurant bill). The `createExpense` function already accepts a `date` param — it's just not exposed in the UI.

**Fix:** Add a date input field:
```tsx
const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

<Input type="date" value={date} onChange={e => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />

// In handleSubmit:
await createExpense(description, amountNum, category, splits, date);
```

---

### 14. `navigate(-1)` in Analytics Goes Outside App
**File:** `src/pages/Analytics.tsx`  
**Severity:** MEDIUM (Navigation Bug)

```typescript
<Button onClick={() => navigate(-1)}>
```

If a user typed the `/analytics` URL directly or opened it from a bookmark, `navigate(-1)` sends them to an external site or the browser's previous page (not `/`).

**Fix:**
```typescript
<Button onClick={() => navigate('/')}>
```

---

### 15. No Expense or Group Delete/Edit Functionality
**Files:** `ExpenseCard.tsx`, `GroupCard.tsx`  
**Severity:** MEDIUM (Missing Critical Feature)

There's no way to edit an expense description, amount, or category after adding it. There's no way to delete a wrong expense. Similarly, groups can't be renamed, have their icon changed, or be deleted.

**Fix:** Add a long-press menu or swipe-to-reveal delete on `ExpenseCard`. Add a `...` menu on `GroupCard` for edit/delete options.

---

### 16. `NotificationBell` Component Exists But Is Never Used
**File:** `src/components/NotificationBell.tsx`  
**Severity:** MEDIUM (Dead Code)

The component was built but never imported or rendered anywhere. The Dashboard header has no notification bell — the only indicator is the badge on the bottom nav tab.

**Fix:** Import it in `Dashboard.tsx` header:
```tsx
import { NotificationBell } from '@/components/NotificationBell';
// In the header right side:
<div className="flex items-center gap-2">
  <NotificationBell />
  <ThemeToggle />
</div>
```

---

### 17. QueryClient is Set Up But React Query Is Never Actually Used
**File:** `src/App.tsx`  
**Severity:** MEDIUM (Unnecessary Bloat)

`QueryClientProvider` wraps the app, but not a single `useQuery` or `useMutation` call exists anywhere. All data fetching uses custom `useState`/`useEffect` hooks. `@tanstack/react-query` is imported and bundled for zero benefit.

**Fix:** Either migrate data fetching hooks to use `useQuery` (recommended — you'd get caching, background refetch, deduplication for free), OR remove `react-query` entirely from the project.

---

## 🟢 LOW — Minor Issues & Improvements

---

### 18. Supabase `.temp` and `.branches` Files Committed
**Files:** `supabase/.temp/cli-latest`, `supabase/.branches/_current_branch`

These are local Supabase CLI state files and should not be in version control.

**Fix — add to `.gitignore`:**
```
supabase/.temp
supabase/.branches
```

---

### 19. Split Type Only Supports Equal Splits
**File:** `src/components/AddExpenseDialog.tsx`

The database schema has `expense_splits.amount` for each user, supporting custom amounts. But the UI only calculates equal splits. No percentage or custom split UI exists.

**Fix:** Add a split mode toggle: Equal / By Percentage / Custom. This is a larger feature but the backend already supports it.

---

### 20. Balance Numbers Are Not Consistently Formatted
**File:** `src/pages/GroupDetail.tsx`

In the balances list, amounts use `.toFixed(2)`, but in `BalanceCard` they use `toLocaleString('en-IN', { maximumFractionDigits: 2 })`. This inconsistency means ₹1,000 shows as "1,000" in the card but "1000.00" in the list.

**Fix:** Create a shared `formatINR(amount: number)` utility in `src/lib/utils.ts`:
```typescript
export const formatINR = (amount: number) =>
  amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
```

---

### 21. Firebase/Supabase Realtime Only Subscribes to Notifications, Not Expenses/Groups
**File:** `src/hooks/useNotifications.ts`

Realtime subscription is set up for the notifications table, which is great. But expenses and groups have no realtime update — if another user adds an expense, the current user won't see it without refreshing the page.

**Fix:** Add realtime subscriptions in `useExpenses` and `useGroups`:
```typescript
// In useExpenses — after fetchExpenses():
useEffect(() => {
  if (!groupId) return;
  const channel = supabase
    .channel(`expenses:${groupId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, fetchExpenses)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [groupId, fetchExpenses]);
```

---

### 22. Notification Channel Name Collision
**File:** `src/hooks/useNotifications.ts`

```typescript
const channel = supabase.channel('notifications')
```

The channel name `'notifications'` is hardcoded. If multiple instances of the hook mount (unlikely but possible), they'd share the same channel and cause unexpected behavior.

**Fix:** Use the user ID to namespace the channel:
```typescript
const channel = supabase.channel(`notifications:${user.id}`)
```

---

## 📋 Summary Table

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 1 | `.env.production` in public repo — API keys exposed | 🔴 CRITICAL | `.env.production` |
| 2 | Theme system conflict — Profile toggle broken | 🔴 CRITICAL | `Profile.tsx`, `App.tsx` |
| 3 | Duplicate `useExpenses` hook in dialog | 🟠 HIGH | `AddExpenseDialog.tsx` |
| 4 | N+1 queries in Analytics (36+ DB calls) | 🟠 HIGH | `useAnalytics.ts` |
| 5 | Analytics balance calculation incorrect | 🟠 HIGH | `useAnalytics.ts` |
| 6 | Group creation not atomic — orphan group risk | 🟠 HIGH | `useGroups.ts` |
| 7 | Floating-point split amounts (money math bug) | 🟠 HIGH | `AddExpenseDialog.tsx` |
| 8 | `setLoading` after navigate on unmounted component | 🟠 HIGH | `Auth.tsx` |
| 9 | Dead profile fetch leaking 100 user records | 🟠 HIGH | `useGroups.ts` |
| 10 | No protected route guard on auth pages | 🟡 MEDIUM | `Analytics`, `Profile`, `Notifications` |
| 11 | Dead `showBell` state variable | 🟡 MEDIUM | `Dashboard.tsx` |
| 12 | No "Paid By" selector in Add Expense | 🟡 MEDIUM | `AddExpenseDialog.tsx` |
| 13 | No date picker — always defaults to today | 🟡 MEDIUM | `AddExpenseDialog.tsx` |
| 14 | `navigate(-1)` can exit app | 🟡 MEDIUM | `Analytics.tsx` |
| 15 | No expense / group edit or delete | 🟡 MEDIUM | `ExpenseCard`, `GroupCard` |
| 16 | `NotificationBell` component never rendered | 🟡 MEDIUM | `NotificationBell.tsx` |
| 17 | React Query installed but never used | 🟡 MEDIUM | `App.tsx` + all hooks |
| 18 | Supabase temp files in git | 🟢 LOW | `.gitignore` |
| 19 | Only equal splits supported (no % or custom) | 🟢 LOW | `AddExpenseDialog.tsx` |
| 20 | Inconsistent currency formatting | 🟢 LOW | `GroupDetail.tsx`, `BalanceCard.tsx` |
| 21 | No realtime updates for expenses/groups | 🟢 LOW | `useExpenses.ts`, `useGroups.ts` |
| 22 | Notification channel name collision risk | 🟢 LOW | `useNotifications.ts` |

---

## 🔧 Recommended Fix Priority

**Do immediately (before any more users sign up):**
- Fix #1: Rotate Supabase keys, remove `.env.production` from repo

**This sprint:**
- Fix #2: Theme system conflict
- Fix #7: Money math (floating point)
- Fix #8: State on unmounted component
- Fix #9: Remove dead profile fetch
- Fix #3: Duplicate hook in AddExpenseDialog

**Next sprint:**
- Fix #4 + #5: Analytics performance & correctness
- Fix #6: Group creation atomicity
- Fix #10: Protected routes
- Fix #12 + #13: "Paid by" + date picker in Add Expense

---

*Generated by automated code review. All file paths relative to project root.*
