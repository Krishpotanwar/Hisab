import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGroupChat } from '@/hooks/useGroupChat';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface GroupChatProps {
  groupId: string;
}

export function GroupChat({ groupId }: GroupChatProps) {
  const { user } = useAuth();
  const { messages, loading, sending, sendMessage } = useGroupChat(groupId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const content = input;
    setInput('');
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[60dvh] items-center justify-center text-muted-foreground">
        <p className="text-sm">Loading chat…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[60dvh]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">No messages yet. Say hello! 👋</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === user?.id;
            return (
              <div
                key={msg.id}
                className={cn('flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}
              >
                {!isMe && (
                  <span className="text-xs text-muted-foreground font-medium px-1">
                    {msg.sender_name}
                  </span>
                )}
                <div
                  className={cn(
                    'max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed',
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground/60 px-1">
                  {format(new Date(msg.created_at), 'h:mm a')}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-border/50 px-4 py-3 flex items-center gap-2 bg-background/80">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className="flex-1"
          disabled={sending}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
