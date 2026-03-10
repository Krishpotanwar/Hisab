import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Trash2, ChevronDown } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useExpenseComments } from '@/hooks/useExpenseComments';
import { useAuth } from '@/lib/auth';
import { MemberAvatar } from '@/components/MemberAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ExpenseCommentsProps {
  expenseId: string;
}

function formatRelativeTime(dateStr: string): string {
  return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: true });
}

export function ExpenseComments({ expenseId }: ExpenseCommentsProps) {
  const { user } = useAuth();
  const { comments, loading, submitting, addComment, deleteComment } =
    useExpenseComments(expenseId);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, open]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const content = input;
    setInput('');
    await addComment(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const commentCount = comments.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-2 w-full"
          type="button"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>
            {commentCount === 0
              ? 'Add comment'
              : `${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
          </span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 ml-auto transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 border-t border-border/40 pt-2 space-y-2">
          {/* Comment list */}
          {loading ? (
            <p className="text-xs text-muted-foreground py-1">Loading...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">
              No comments yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {comments.map((comment) => {
                const isOwn = comment.user_id === user?.id;
                return (
                  <div key={comment.id} className="flex items-start gap-2">
                    <MemberAvatar
                      name={comment.user_name}
                      avatarUrl={comment.avatar_url}
                      size="sm"
                      className="flex-shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-medium text-foreground truncate">
                          {isOwn ? 'You' : comment.user_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                          {formatRelativeTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed break-words">
                        {comment.content}
                      </p>
                    </div>
                    {isOwn && (
                      <button
                        type="button"
                        onClick={() => deleteComment(comment.id)}
                        className="text-muted-foreground/50 hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-1.5">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment..."
              className="h-8 text-xs flex-1"
              disabled={submitting}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSend}
              disabled={submitting || !input.trim()}
              className="h-8 w-8 flex-shrink-0"
              aria-label="Send comment"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
