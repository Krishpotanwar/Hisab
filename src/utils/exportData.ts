import type { MonthlyData, BalanceSummary, CategoryData } from '@/hooks/useAnalytics';
import type { Expense } from '@/hooks/useExpenses';

// ── CSV Export ───────────────────────────────────────────────────────────────

function arrayToCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\n');
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Analytics CSV ────────────────────────────────────────────────────────────

export interface AnalyticsExportData {
  monthlyData: MonthlyData[];
  balances: BalanceSummary[];
  categoryData: CategoryData[];
  totalThisMonth: number;
  totalOwedToMe: number;
  totalIOwe: number;
}

export function exportAnalyticsToCSV(data: AnalyticsExportData, filename: string) {
  const sections: string[] = [];

  // Summary
  sections.push('HisaabKitaab Expense Report');
  sections.push(`Generated on,${new Date().toLocaleDateString('en-IN')}`);
  sections.push('');
  sections.push('Summary');
  sections.push(`Total This Month,${data.totalThisMonth.toFixed(2)}`);
  sections.push(`Owed To Me,${data.totalOwedToMe.toFixed(2)}`);
  sections.push(`I Owe,${data.totalIOwe.toFixed(2)}`);
  sections.push('');

  // Monthly breakdown
  sections.push('Monthly Spending');
  sections.push(arrayToCSV(
    ['Month', 'Group Total', 'My Share'],
    data.monthlyData.map((m) => [m.month, m.total.toFixed(2), m.myShare.toFixed(2)]),
  ));
  sections.push('');

  // Category breakdown
  sections.push('Category Breakdown');
  sections.push(arrayToCSV(
    ['Category', 'Total'],
    data.categoryData.map((c) => [c.label, c.total.toFixed(2)]),
  ));
  sections.push('');

  // Balances
  sections.push('Balances');
  sections.push(arrayToCSV(
    ['Name / Group', 'Amount'],
    data.balances.map((b) => [b.name, b.amount.toFixed(2)]),
  ));

  downloadBlob(sections.join('\n'), filename, 'text/csv;charset=utf-8;');
}

// ── Analytics PDF (print-based) ──────────────────────────────────────────────

export function exportAnalyticsToPDF(data: AnalyticsExportData, filename: string) {
  const fmt = (n: number) => `\u20B9${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${filename}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
  .summary { display: flex; gap: 16px; margin-bottom: 32px; }
  .summary-card { flex: 1; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px 16px; }
  .summary-card .label { font-size: 12px; color: #888; margin-bottom: 4px; }
  .summary-card .value { font-size: 18px; font-weight: 600; }
  .green { color: #16a34a; }
  .red { color: #dc2626; }
  h2 { font-size: 16px; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #6366f1; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { text-align: left; font-size: 12px; color: #666; padding: 8px 12px; border-bottom: 2px solid #e5e5e5; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  tr:nth-child(even) { background: #fafafa; }
  .text-right { text-align: right; }
  @media print {
    body { padding: 20px; }
    @page { margin: 20mm; }
  }
</style>
</head>
<body>
  <h1>HisaabKitaab Expense Report</h1>
  <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>

  <div class="summary">
    <div class="summary-card">
      <div class="label">Total This Month</div>
      <div class="value">${fmt(data.totalThisMonth)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Owed To Me</div>
      <div class="value green">${fmt(data.totalOwedToMe)}</div>
    </div>
    <div class="summary-card">
      <div class="label">I Owe</div>
      <div class="value red">${fmt(data.totalIOwe)}</div>
    </div>
  </div>

  <h2>Monthly Spending</h2>
  <table>
    <thead><tr><th>Month</th><th class="text-right">Group Total</th><th class="text-right">My Share</th></tr></thead>
    <tbody>
      ${data.monthlyData.map((m) => `<tr><td>${m.month}</td><td class="text-right">${fmt(m.total)}</td><td class="text-right">${fmt(m.myShare)}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>Category Breakdown</h2>
  <table>
    <thead><tr><th>Category</th><th class="text-right">Total</th></tr></thead>
    <tbody>
      ${data.categoryData.length > 0
        ? data.categoryData.map((c) => `<tr><td>${c.icon} ${c.label}</td><td class="text-right">${fmt(c.total)}</td></tr>`).join('')
        : '<tr><td colspan="2" style="text-align:center;color:#888;">No expenses yet</td></tr>'}
    </tbody>
  </table>

  <h2>Balances</h2>
  <table>
    <thead><tr><th>Name / Group</th><th class="text-right">Amount</th></tr></thead>
    <tbody>
      ${data.balances.length > 0
        ? data.balances.map((b) => `<tr><td>${b.name}</td><td class="text-right ${b.amount >= 0 ? 'green' : 'red'}">${b.amount >= 0 ? '+' : '-'}${fmt(b.amount)}</td></tr>`).join('')
        : '<tr><td colspan="2" style="text-align:center;color:#888;">All settled up</td></tr>'}
    </tbody>
  </table>

  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ── Group Expenses CSV ───────────────────────────────────────────────────────

export function exportExpensesToCSV(expenses: Expense[], groupName: string, filename: string) {
  const headers = ['Date', 'Description', 'Category', 'Amount', 'Paid By', 'Notes'];
  const rows = expenses.map((e) => [
    new Date(e.date).toLocaleDateString('en-IN'),
    e.description,
    e.category,
    e.amount.toFixed(2),
    e.paid_by_name || e.paid_by,
    e.notes || '',
  ]);

  const sections: string[] = [];
  sections.push(`${groupName} - Expenses`);
  sections.push(`Generated on,${new Date().toLocaleDateString('en-IN')}`);
  sections.push('');
  sections.push(arrayToCSV(headers, rows));

  downloadBlob(sections.join('\n'), filename, 'text/csv;charset=utf-8;');
}

// ── Group Expenses PDF (print-based) ─────────────────────────────────────────

export function exportExpensesToPDF(expenses: Expense[], groupName: string, filename: string) {
  const fmt = (n: number) => `\u20B9${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${filename}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
  .total-bar { background: #f5f5ff; border: 1px solid #e0e0ff; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
  .total-bar .label { font-size: 14px; color: #555; }
  .total-bar .value { font-size: 20px; font-weight: 600; color: #6366f1; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 12px; color: #666; padding: 8px 12px; border-bottom: 2px solid #e5e5e5; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  tr:nth-child(even) { background: #fafafa; }
  .text-right { text-align: right; }
  @media print {
    body { padding: 20px; }
    @page { margin: 20mm; }
  }
</style>
</head>
<body>
  <h1>${groupName} - Expense Report</h1>
  <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>

  <div class="total-bar">
    <span class="label">Total Expenses (${expenses.length} items)</span>
    <span class="value">${fmt(total)}</span>
  </div>

  <table>
    <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Paid By</th><th class="text-right">Amount</th></tr></thead>
    <tbody>
      ${expenses.length > 0
        ? expenses.map((e) => `<tr>
            <td>${new Date(e.date).toLocaleDateString('en-IN')}</td>
            <td>${e.description}</td>
            <td>${e.category}</td>
            <td>${e.paid_by_name || e.paid_by}</td>
            <td class="text-right">${fmt(e.amount)}</td>
          </tr>`).join('')
        : '<tr><td colspan="5" style="text-align:center;color:#888;padding:24px;">No expenses yet</td></tr>'}
    </tbody>
  </table>

  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
