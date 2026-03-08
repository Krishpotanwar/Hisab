import { motion } from 'framer-motion';
import { Users, ChevronRight } from 'lucide-react';
import { Group } from '@/hooks/useGroups';
import { cn } from '@/lib/utils';

interface GroupCardProps {
  group: Group;
  onClick: () => void;
  index?: number;
}

export function GroupCard({ group, onClick, index = 0 }: GroupCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left bg-card rounded-2xl p-4 shadow-card hover:shadow-float transition-all duration-300 border border-border/50 group"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
          {group.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{group.name}</h3>
          {group.description && (
            <p className="text-sm text-muted-foreground truncate">{group.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{group.member_count || 1} member{(group.member_count || 1) !== 1 ? 's' : ''}</span>
          </div>
        </div>
        
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>
    </motion.button>
  );
}
