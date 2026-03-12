/// <reference lib="deno.unstable" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return jsonResponse({ error: "Razorpay credentials not configured" }, 500);
  }

  try {
    const { amount } = await req.json() as { amount: number };

    if (!amount || amount < 1) {
      return jsonResponse({ error: "Minimum amount is ₹1" }, 400);
    }

    const authHeader = `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`;
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        currency: "INR",
        receipt: crypto.randomUUID(),
        notes: { type: "support" },
        payment_capture: 1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Razorpay error: ${err}`);
    }

    const order = await response.json() as { id: string; amount: number; currency: string };

    return jsonResponse({
      provider_order_id: order.id,
      amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
