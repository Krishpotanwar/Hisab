export {};

declare global {
  interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description?: string;
    order_id: string;
    prefill?: {
      email?: string;
      name?: string;
    };
    notes?: Record<string, string>;
    handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
    modal?: {
      ondismiss?: () => void;
    };
    theme?: {
      color?: string;
    };
  }

  interface RazorpayInstance {
    open: () => void;
  }

  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}
