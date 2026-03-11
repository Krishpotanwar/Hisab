import { useState } from 'react';
import { Link2, Copy, Check, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ReactDOM from 'react-dom';

interface Props {
  groupId: string;
  groupName: string;
  onClose: () => void;
}

export function InviteLinkDialog({ groupId, groupName, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}/join/${groupId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(inviteUrl)}&size=200x200&margin=8`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = inviteUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${groupName} on HisaabKitaab`,
          text: `You've been invited to join "${groupName}" on HisaabKitaab. Click the link to join:`,
          url: inviteUrl,
        });
      } catch (err: any) {
        // User cancelled share — not an error
        if (err?.name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    } else {
      // Fallback: just copy the link
      handleCopy();
    }
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border/50 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" /> Invite Link
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Share this link or QR code to invite people to <strong>{groupName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code */}
        <div className="px-5 py-5 flex flex-col items-center gap-4">
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <img
              src={qrCodeUrl}
              alt={`QR code for joining ${groupName}`}
              width={200}
              height={200}
              className="block"
            />
          </div>

          {/* Invite URL */}
          <div className="w-full flex items-center gap-2 bg-muted rounded-xl p-2 pl-3">
            <span className="text-sm text-muted-foreground truncate flex-1 select-all">
              {inviteUrl}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/50 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button className="flex-1" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-1.5" />
            Share
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}
