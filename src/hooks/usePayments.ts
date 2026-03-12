import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface CreateOrderResponse {
  payment_order_id: string;
  provider_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

interface StartSettlementPaymentInput {
  groupId: string;
  payeeUserId: string;
  amount: number;
  notes?: string;
  onVerified?: () => Promise<void>;
}

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

const loadRazorpayScript = async () => {
  if (window.Razorpay) {
    return true;
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
  if (existing) {
    return new Promise<boolean>((resolve) => {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
    });
  }

  return new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export function usePayments() {
  const { user } = useAuth();
  const [processingPayment, setProcessingPayment] = useState(false);

  const startSettlementPayment = async ({
    groupId,
    payeeUserId,
    amount,
    notes,
    onVerified,
  }: StartSettlementPaymentInput) => {
    if (!user) {
      return { error: new Error('Not authenticated') };
    }
    if (amount <= 0) {
      return { error: new Error('Amount must be greater than zero') };
    }

    setProcessingPayment(true);

    const scriptReady = await loadRazorpayScript();
    if (!scriptReady || !window.Razorpay) {
      setProcessingPayment(false);
      return { error: new Error('Unable to load payment gateway') };
    }

    // Explicitly pass the session token — supabase.functions.invoke may not attach it automatically
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke<CreateOrderResponse>('create-payment-order', {
      body: {
        group_id: groupId,
        payee_user_id: payeeUserId,
        amount,
        notes: notes ?? null,
      },
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    });

    if (error || !data) {
      setProcessingPayment(false);
      console.error('[create-payment-order] raw error:', error, 'data:', data);
      // Extract the real error message — try multiple approaches since
      // the Response body may already be partially consumed by the SDK
      let message = 'Failed to create payment order';
      try {
        // Approach 1: clone the response before reading
        const resp = (error as any)?.context as Response | undefined;
        if (resp) {
          const body = await resp.clone().json().catch(() => null);
          if (body?.error) {
            message = body.error;
          } else {
            // Approach 2: raw text
            const text = await resp.clone().text().catch(() => '');
            if (text) message = text;
          }
        } else if ((error as any)?.message && (error as any).message !== 'Edge Function returned a non-2xx status code') {
          // Approach 3: error.message already has something useful
          message = (error as any).message;
        }
      } catch { /* ignore */ }
      return { error: new Error(message) };
    }

    return new Promise<{ error: Error | null }>((resolve) => {
      const razorpay = new window.Razorpay({
        key: data.key_id,
        amount: Math.round(data.amount * 100),
        currency: data.currency,
        name: 'HisaabKitaab',
        description: 'Settle balance',
        order_id: data.provider_order_id,
        prefill: {
          email: user.email,
          name: user.user_metadata?.full_name,
        },
        notes: {
          group_id: groupId,
          payee_user_id: payeeUserId,
        },
        theme: {
          color: '#1AA688',
        },
        handler: async (response) => {
          const { error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
            body: {
              payment_order_id: data.payment_order_id,
              provider_order_id: response.razorpay_order_id,
              provider_payment_id: response.razorpay_payment_id,
              provider_signature: response.razorpay_signature,
              notes: notes ?? null,
            },
          });

          if (verifyError) {
            setProcessingPayment(false);
            resolve({ error: new Error(verifyError.message) });
            return;
          }

          try {
            if (onVerified) {
              await onVerified();
            }
            setProcessingPayment(false);
            resolve({ error: null });
          } catch (onVerifiedError) {
            setProcessingPayment(false);
            const message =
              onVerifiedError instanceof Error
                ? onVerifiedError.message
                : 'Payment verified but settlement update failed';
            resolve({ error: new Error(message) });
          }
        },
        modal: {
          ondismiss: () => {
            setProcessingPayment(false);
            resolve({ error: new Error('Payment cancelled') });
          },
        },
      });

      razorpay.open();
    });
  };

  return {
    processingPayment,
    startSettlementPayment,
  };
}
