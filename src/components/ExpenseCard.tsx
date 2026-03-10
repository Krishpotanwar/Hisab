import { motion } from 'framer-motion';
import { Repeat } from 'lucide-react';
import { Expense, getCategoryInfo } from '@/hooks/useExpenses';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { getCurrencySymbol } from '@/utils/currency';
import { ExpenseComments } from '@/components/ExpenseComments';

interface ExpenseCardProps {
  expense: Expense;
  index?: number;
  currency?: string;
}

export function ExpenseCard({ expense, index = 0, currency = 'INR' }: ExpenseCardProps) {
  const { user } = useAuth();
  const category = getCategoryInfo(expense.category);
  const isPayer = expense.paid_by === user?.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-card rounded-xl p-4 shadow-sm border border-border/50"
    >
      <div className="flex items-start gap-3">
        <div 
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0",
            expense.category === 'food' && "bg-category-food/10 dark:bg-category-food/20",
            expense.category === 'transport' && "bg-category-transport/10 dark:bg-category-transport/20",
            expense.category === 'entertainment' && "bg-category-entertainment/10 dark:bg-category-entertainment/20",
            expense.category === 'shopping' && "bg-category-shopping/10 dark:bg-category-shopping/20",
            expense.category === 'utilities' && "bg-category-utilities/10 dark:bg-category-utilities/20",
            expense.category === 'healthcare' && "bg-category-healthcare/10 dark:bg-category-healthcare/20",
            expense.category === 'other' && "bg-category-other/10 dark:bg-category-other/20",
          )}
        >
          {category.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-medium text-foreground truncate">{expense.description}</h4>
            {expense.is_recurring && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex-shrink-0">
                <Repeat className="w-2.5 h-2.5" />
                {expense.recurring_interval ? expense.recurring_interval.charAt(0).toUpperCase() + expense.recurring_interval.slice(1) : 'Recurring'}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isPayer ? 'You paid' : `${expense.paid_by_name} paid`}
          </p>
        </div>
        
        <div className="text-right">
          <p className="font-semibold text-foreground">
            {getCurrencySymbol(currency)}{Number(expense.amount).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US')}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(expense.date).toLocaleDateString('en-IN', { 
              day: 'numeric', 
              month: 'short' 
            })}
          </p>
        </div>
      </div>

      {/* Comment thread */}
      <ExpenseComments expenseId={expense.id} />
    </motion.div>
  );
}
