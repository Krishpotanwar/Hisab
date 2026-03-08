/// <reference lib="deno.unstable" />

import { createClient } from "jsr:@supabase/supabase-js@2";

type VerifyPayload = {
  payment_order_id?: string;
  provider_order_id?: string;
  provider_payment_id?: string;
  provider_signature?: string;
  notes?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const getUserIdFromToken = async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  return user?.id ?? null;
};

const createHmacSha256 = async (payload: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!RAZORPAY_KEY_SECRET) {
    return jsonResponse({ error: "Razorpay key secret is not configured" }, 500);
  }

  try {
    const userId = await getUserIdFromToken(req);
    if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as VerifyPayload;
    const paymentOrderId = body.payment_order_id?.trim();
    const providerOrderId = body.provider_order_id?.trim();
    const providerPaymentId = body.provider_payment_id?.trim();
    const providerSignature = body.provider_signature?.trim();

    if (!paymentOrderId || !providerOrderId || !providerPaymentId || !providerSignature) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const { data: paymentOrder, error: paymentOrderError } = await supabaseAdmin
      .from("payment_orders")
      .select("*")
      .eq("id", paymentOrderId)
      .single();

    if (paymentOrderError || !paymentOrder) {
      return jsonResponse({ error: "Payment order not found" }, 404);
    }

    if (paymentOrder.payer_user_id !== userId) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    if (paymentOrder.provider_order_id !== providerOrderId) {
      return jsonResponse({ error: "Provider order mismatch" }, 400);
    }

    const payload = `${providerOrderId}|${providerPaymentId}`;
    const expectedSignature = await createHmacSha256(payload, RAZORPAY_KEY_SECRET);

    if (expectedSignature !== providerSignature) {
      return jsonResponse({ error: "Invalid payment signature" }, 400);
    }

    const { error: updateOrderError } = await supabaseAdmin
      .from("payment_orders")
      .update({
        status: "paid",
        metadata: {
          ...(paymentOrder.metadata ?? {}),
          verified_at: new Date().toISOString(),
        },
      })
      .eq("id", paymentOrderId);

    if (updateOrderError) {
      return jsonResponse({ error: updateOrderError.message }, 500);
    }

    const { error: transactionError } = await supabaseAdmin.from("payment_transactions").upsert(
      {
        payment_order_id: paymentOrderId,
        provider: "razorpay",
        provider_payment_id: providerPaymentId,
        provider_signature: providerSignature,
        amount: paymentOrder.amount,
        status: "captured",
        raw_response: {
          provider_order_id: providerOrderId,
        },
      },
      { onConflict: "provider_payment_id" },
    );

    if (transactionError) {
      return jsonResponse({ error: transactionError.message }, 500);
    }

    const { error: settlementError } = await supabaseAdmin.from("settlements").upsert(
      {
        group_id: paymentOrder.group_id,
        from_user: paymentOrder.payer_user_id,
        to_user: paymentOrder.payee_user_id,
        amount: paymentOrder.amount,
        notes: body.notes ?? paymentOrder.notes ?? "Settled via Razorpay",
        payment_order_id: paymentOrderId,
      },
      { onConflict: "payment_order_id", ignoreDuplicates: true },
    );

    if (settlementError) {
      return jsonResponse({ error: settlementError.message }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
