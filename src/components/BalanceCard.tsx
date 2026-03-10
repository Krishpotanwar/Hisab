import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrencySymbol } from '@/utils/currency';

interface BalanceCardProps {
  balance: number;
  label?: string;
  currency?: string;
  className?: string;
}

export function BalanceCard({ balance, label = "Your balance", currency = "INR", className }: BalanceCardProps) {
  const isPositive = balance > 0;
  const isNegative = balance < 0;
  const isZero = balance === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-6",
        isPositive && "bg-gradient-to-br from-success/10 to-success/5 border border-success/20",
        isNegative && "bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20",
        isZero && "bg-gradient-to-br from-muted to-muted/50 border border-border",
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 blur-2xl"
        style={{ 
          backgroundColor: isPositive ? 'hsl(var(--success))' : isNegative ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'
        }}
      />
      
      <div className="relative">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-xl",
            isPositive && "bg-success/20 text-success",
            isNegative && "bg-destructive/20 text-destructive",
            isZero && "bg-muted-foreground/20 text-muted-foreground"
          )}>
            {isPositive && <TrendingUp className="w-5 h-5" />}
            {isNegative && <TrendingDown className="w-5 h-5" />}
            {isZero && <Minus className="w-5 h-5" />}
          </div>
          
          <div>
            <span className={cn(
              "text-3xl font-bold",
              isPositive && "text-success",
              isNegative && "text-destructive",
              isZero && "text-muted-foreground"
            )}>
              {isPositive && "+"} 
              {isNegative && "-"}
              {getCurrencySymbol(currency)}{Math.abs(balance).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        
        <p className={cn(
          "mt-2 text-sm font-medium",
          isPositive && "text-success",
          isNegative && "text-destructive",
          isZero && "text-muted-foreground"
        )}>
          {isPositive && "You are owed"}
          {isNegative && "You owe"}
          {isZero && "All settled up!"}
        </p>
      </div>
    </motion.div>
  );
}
