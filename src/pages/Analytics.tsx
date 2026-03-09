import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, Users, Tag, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalytics } from '@/hooks/useAnalytics';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { NotificationBell } from '@/components/NotificationBell';

const PIE_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#f97316'];

const fmt = (n: number) =>
  n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${n.toFixed(0)}`;

export default function Analytics() {
  const navigate = useNavigate();
  const { monthlyData, balances, categoryData, totalThisMonth, totalOwedToMe, totalIOwe, loading } = useAnalytics();

  const iOwe   = balances.filter((b) => b.amount < 0);
  const oweMe  = balances.filter((b) => b.amount > 0);

  const balanceChartData = [
    ...iOwe.map((b)  => ({ name: b.name, amount: -b.amount,  fill: '#ef4444', type: 'I owe' })),
    ...oweMe.map((b) => ({ name: b.name, amount: b.amount,   fill: '#10b981', type: 'Owes me' })),
  ].slice(0, 10);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading analytics…</div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container max-w-2xl mx-auto px-4 pb-4 pt-[calc(1rem+var(--safe-area-top))] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">Analytics</h1>
              <p className="text-xs text-muted-foreground">Your spending overview</p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 pb-12 space-y-6">
        {/* Summary cards */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-3">
          {[
            { label: 'This month', value: totalThisMonth, icon: TrendingUp, color: 'text-primary' },
            { label: 'Owed to me', value: totalOwedToMe, icon: IndianRupee, color: 'text-green-500' },
            { label: 'I owe',      value: totalIOwe,      icon: IndianRupee, color: 'text-red-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card rounded-2xl p-3 border border-border/50 shadow-sm text-center">
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
              <p className="font-bold text-base">{fmt(value)}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* Monthly spending */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border/50 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Monthly Spending</h2>
          </div>
          {monthlyData.every((m) => m.total === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">No expenses yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                <Tooltip
                  formatter={(val: number, name: string) => [fmt(val), name === 'total' ? 'Group total' : 'My share']}
                  contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 12 }}
                  cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                />
                <Bar dataKey="total"   fill="#6366f133" radius={[4,4,0,0]} name="total" />
                <Bar dataKey="myShare" fill="#6366f1"   radius={[4,4,0,0]} name="myShare" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            <span className="inline-block w-3 h-3 rounded-sm bg-primary/20 mr-1 align-middle" />Group total
            <span className="inline-block w-3 h-3 rounded-sm bg-primary ml-3 mr-1 align-middle" />My share
          </p>
        </motion.div>

        {/* Who owes whom */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card rounded-2xl border border-border/50 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Balances</h2>
          </div>
          {balanceChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">All settled up! 🎉</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(120, balanceChartData.length * 36)}>
                <BarChart data={balanceChartData} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: number) => [fmt(val)]}
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 12 }}
                  />
                  <Bar dataKey="amount" radius={[0,4,4,0]}>
                    {balanceChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 justify-center text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />I owe</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />Owes me</span>
              </div>
            </>
          )}
        </motion.div>

        {/* Category breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border/50 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">By Category</h2>
          </div>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No expenses yet</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} dataKey="total" nameKey="label" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [fmt(val)]}
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 12 }}
                  />
                  <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Category list */}
          {categoryData.length > 0 && (
            <div className="space-y-2 mt-2">
              {categoryData.map((c, i) => {
                const total = categoryData.reduce((s, x) => s + x.total, 0);
                const pct = total > 0 ? (c.total / total) * 100 : 0;
                return (
                  <div key={c.category} className="flex items-center gap-2">
                    <span className="text-base w-6 text-center">{c.icon}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span>{c.label}</span>
                        <span className="text-muted-foreground">{fmt(c.total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
