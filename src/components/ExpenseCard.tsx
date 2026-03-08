import { motion } from 'framer-motion';
import { Expense, getCategoryInfo } from '@/hooks/useExpenses';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface ExpenseCardProps {
  expense: Expense;
  index?: number;
}

export function ExpenseCard({ expense, index = 0 }: ExpenseCardProps) {
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
          <h4 className="font-medium text-foreground truncate">{expense.description}</h4>
          <p className="text-sm text-muted-foreground">
            {isPayer ? 'You paid' : `${expense.paid_by_name} paid`}
          </p>
        </div>
        
        <div className="text-right">
          <p className="font-semibold text-foreground">
            ₹{Number(expense.amount).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(expense.date).toLocaleDateString('en-IN', { 
              day: 'numeric', 
              month: 'short' 
            })}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
