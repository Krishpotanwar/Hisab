import { useRef } from 'react';
import { Scan, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useReceiptOcr } from '@/hooks/useReceiptOcr';
import { cn } from '@/lib/utils';

interface ReceiptScanButtonProps {
  onScanned: (amount: number | null, text: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ReceiptScanButton({ onScanned, disabled, className }: ReceiptScanButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { scanReceipt, scanning, progress } = useReceiptOcr();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large — max 10 MB');
      return;
    }

    const toastId = toast.loading('Reading receipt…');
    const { data, error } = await scanReceipt(file);
    toast.dismiss(toastId);

    if (error) {
      toast.error('Could not read receipt');
      return;
    }

    if (data) {
      if (data.totalAmount) {
        toast.success(`Detected ₹${data.totalAmount.toLocaleString('en-IN')}`);
      } else {
        toast.info('Receipt scanned — enter amount manually');
      }
      onScanned(data.totalAmount, data.ocrText);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || scanning}
        onClick={() => inputRef.current?.click()}
        className={cn('gap-1.5 text-xs', className)}
      >
        {scanning
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{progress > 0 ? `${progress}%` : 'Reading…'}</>
          : <><Scan className="w-3.5 h-3.5" />Scan Receipt</>
        }
      </Button>
    </>
  );
}

