import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

const PRESET_AMOUNTS = [10, 30, 50, 100];

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

const loadRazorpayScript = (): Promise<boolean> => {
  if ((window as any).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export function BuyMeAChai() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const amount = custom ? parseFloat(custom) : selected;

  const handlePay = async () => {
    if (!amount || amount < 1) {
      toast.error('Minimum amount is ₹1');
      return;
    }

    setLoading(true);

    const scriptReady = await loadRazorpayScript();
    if (!scriptReady || !(window as any).Razorpay) {
      toast.error('Could not load payment gateway. Please try again.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke<{
      provider_order_id: string;
      amount: number;
      currency: string;
      key_id: string;
    }>('create-support-order', { body: { amount } });

    if (error || !data) {
      toast.error('Failed to create order. Please try again.');
      setLoading(false);
      return;
    }

    const razorpay = new (window as any).Razorpay({
      key: data.key_id,
      amount: Math.round(data.amount * 100),
      currency: data.currency,
      name: 'HisaabKitaab',
      description: '☕ Buy the developer a chai!',
      order_id: data.provider_order_id,
      prefill: {
        email: user?.email ?? '',
        name: user?.user_metadata?.full_name ?? '',
      },
      theme: { color: '#d97706' },
      modal: {
        ondismiss: () => setLoading(false),
      },
      handler: () => {
        setLoading(false);
        setShowThankYou(true);
        setSelected(null);
        setCustom('');
        setTimeout(() => setShowThankYou(false), 5000);
      },
    });

    razorpay.open();
  };

  return (
    <div className="mx-4 mb-4 rounded-2xl border border-amber-400/40 bg-amber-50/10 dark:bg-amber-950/10 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xl">🍵</span>
        <div>
          <p className="font-semibold text-sm">Buy me a chai</p>
          <p className="text-xs text-muted-foreground">If you enjoy the app, support the developer!</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showThankYou ? (
          <motion.div
            key="thankyou"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-3 space-y-1"
          >
            <p className="text-2xl">🙏</p>
            <p className="font-semibold text-amber-600 dark:text-amber-400">Thank you so much!</p>
            <p className="text-xs text-muted-foreground">Your support keeps the chai brewing ☕</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {/* Preset amounts */}
            <div className="flex gap-2 flex-wrap">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setSelected(amt); setCustom(''); }}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                    selected === amt && !custom
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">₹</span>
              <Input
                type="number"
                min="1"
                placeholder="Custom amount (min ₹1)"
                value={custom}
                onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
                className="pl-7 h-9 text-sm"
              />
            </div>

            {/* Pay button */}
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium"
              onClick={handlePay}
              disabled={loading || !amount || amount < 1}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <span className="mr-2">🍵</span>
              )}
              {loading ? 'Opening payment...' : `Buy a chai${amount && amount >= 1 ? ` · ₹${amount}` : ''}`}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
