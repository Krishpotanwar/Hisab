import { cn } from '@/lib/utils';

interface MemberAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MemberAvatar({ name, avatarUrl, size = 'md', className }: MemberAvatarProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  // Generate consistent color from name
  const colors = [
    'bg-primary/20 text-primary',
    'bg-accent/20 text-accent',
    'bg-success/20 text-success',
    'bg-category-transport/20 text-category-transport',
    'bg-category-entertainment/20 text-category-entertainment',
    'bg-category-shopping/20 text-category-shopping',
  ];
  
  const colorIndex = name.charCodeAt(0) % colors.length;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn(
          "rounded-full object-cover",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold",
        sizeClasses[size],
        colors[colorIndex],
        className
      )}
    >
      {initials}
    </div>
  );
}
