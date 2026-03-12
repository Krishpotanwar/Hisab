/// <reference lib="deno.unstable" />

import { createClient } from "jsr:@supabase/supabase-js@2";

type CreateOrderPayload = {
  group_id?: string;
  payee_user_id?: string;
  amount?: number;
  notes?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
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
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user?.id ?? null;
};

const createRazorpayOrder = async (amount: number, notes: Record<string, string>) => {
  const authHeader = `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`;
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: crypto.randomUUID(),
      notes,
      payment_capture: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Razorpay order creation failed: ${errorText}`);
  }

  return (await response.json()) as {
    id: string;
    amount: number;
    currency: string;
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return jsonResponse({ error: "Razorpay credentials are not configured" }, 500);
  }

  try {
    const userId = await getUserIdFromToken(req);
    if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as CreateOrderPayload;
    const groupId = body.group_id?.trim();
    const payeeUserId = body.payee_user_id?.trim();
    const amount = Number(body.amount ?? 0);

    if (!groupId || !payeeUserId || Number.isNaN(amount) || amount <= 0) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const { data: membership } = await supabaseAdmin
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return jsonResponse({ error: "You are not a member of this group" }, 403);
    }

    const { data: payeeMembership } = await supabaseAdmin
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", payeeUserId)
      .maybeSingle();

    if (!payeeMembership) {
      return jsonResponse({ error: "Payee is not a member of this group" }, 400);
    }

    const razorpayOrder = await createRazorpayOrder(amount, {
      group_id: groupId,
      payer_user_id: userId,
      payee_user_id: payeeUserId,
    });

    const { data: paymentOrder, error: paymentOrderError } = await supabaseAdmin
      .from("payment_orders")
      .insert({
        group_id: groupId,
        payer_user_id: userId,
        payee_user_id: payeeUserId,
        provider: "razorpay",
        provider_order_id: razorpayOrder.id,
        amount,
        currency: "INR",
        status: "created",
        notes: body.notes ?? null,
        metadata: {
          razorpay_amount: razorpayOrder.amount,
        },
      })
      .select("id")
      .single();

    if (paymentOrderError || !paymentOrder) {
      return jsonResponse({ error: paymentOrderError?.message ?? "Failed to create payment order record" }, 500);
    }

    return jsonResponse({
      payment_order_id: paymentOrder.id,
      provider_order_id: razorpayOrder.id,
      amount,
      currency: "INR",
      key_id: RAZORPAY_KEY_ID,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
