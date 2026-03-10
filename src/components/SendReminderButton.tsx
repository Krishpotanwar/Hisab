import { useState } from 'react';
import { Bell, MessageCircle, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface SendReminderButtonProps {
  debtorName: string;
  amount: number;
  groupName: string;
  debtorUserId: string;
  groupId: string;
}

export function SendReminderButton({
  debtorName,
  amount,
  groupName,
  debtorUserId,
  groupId,
}: SendReminderButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const reminderText = `Hey ${debtorName}, you owe ₹${amount.toFixed(2)} for expenses in "${groupName}" on HisaabKitaab. Settle up at https://hisab-rust.vercel.app/group/${groupId}`;

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(reminderText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
    setOpen(false);
  };

  const handleInApp = async () => {
    setSending(true);
    const myName = user?.user_metadata?.full_name ?? 'Someone';
    await supabase.functions.invoke('notify', {
      body: {
        type: 'reminder',
        recipientUserIds: [debtorUserId],
        title: `${myName} sent you a reminder`,
        body: `You owe ₹${amount.toFixed(2)} in "${groupName}"`,
        groupId,
        groupName,
      },
    });
    setSending(false);
    setOpen(false);
    toast.success(`Reminder sent to ${debtorName}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
          <Bell className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1.5" align="end">
        <button
          onClick={handleWhatsApp}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
        >
          <MessageCircle className="w-4 h-4 text-green-500" />
          Send via WhatsApp
        </button>
        <button
          onClick={handleInApp}
          disabled={sending}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
        >
          <BellRing className="w-4 h-4 text-primary" />
          {sending ? 'Sending...' : 'In-app notification'}
        </button>
      </PopoverContent>
    </Popover>
  );
}
