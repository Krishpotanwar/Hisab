/// <reference lib="deno.unstable" />

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

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
  if (!RAZORPAY_WEBHOOK_SECRET) {
    return jsonResponse({ error: "Webhook secret is not configured" }, 500);
  }

  try {
    const payload = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) {
      return jsonResponse({ error: "Missing signature" }, 400);
    }

    const expectedSignature = await createHmacSha256(payload, RAZORPAY_WEBHOOK_SECRET);
    if (signature !== expectedSignature) {
      return jsonResponse({ error: "Invalid webhook signature" }, 400);
    }

    const event = JSON.parse(payload) as {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } };
      };
      id?: string;
    };

    const eventId = event.id ?? crypto.randomUUID();
    const eventType = event.event ?? "unknown";

    const { error: eventInsertError } = await supabaseAdmin
      .from("payment_events")
      .insert({
        provider: "razorpay",
        provider_event_id: eventId,
        event_type: eventType,
        payload: event,
      });

    const isDuplicateEvent = eventInsertError?.code === "23505";
    if (eventInsertError && !isDuplicateEvent) {
      return jsonResponse({ error: eventInsertError.message }, 500);
    }

    const providerOrderId = event.payload?.payment?.entity?.order_id;
    const providerPaymentId = event.payload?.payment?.entity?.id;

    if (providerOrderId) {
      const { data: paymentOrder, error: paymentOrderLookupError } = await supabaseAdmin
        .from("payment_orders")
        .select("*")
        .eq("provider_order_id", providerOrderId)
        .maybeSingle();

      if (paymentOrderLookupError) {
        return jsonResponse({ error: paymentOrderLookupError.message }, 500);
      }

      if (paymentOrder) {
        if (eventType === "payment.captured") {
          const { error: updateOrderError } = await supabaseAdmin
            .from("payment_orders")
            .update({
              status: "paid",
              metadata: {
                ...(paymentOrder.metadata ?? {}),
                webhook_last_event: eventType,
              },
            })
            .eq("id", paymentOrder.id);

          if (updateOrderError) {
            return jsonResponse({ error: updateOrderError.message }, 500);
          }

          if (providerPaymentId) {
            const { error: transactionError } = await supabaseAdmin.from("payment_transactions").upsert(
              {
                payment_order_id: paymentOrder.id,
                provider: "razorpay",
                provider_payment_id: providerPaymentId,
                amount: paymentOrder.amount,
                status: "captured",
                raw_response: event,
              },
              { onConflict: "provider_payment_id" },
            );

            if (transactionError) {
              return jsonResponse({ error: transactionError.message }, 500);
            }
          }
        } else if (eventType === "payment.failed") {
          const { error: updateOrderError } = await supabaseAdmin
            .from("payment_orders")
            .update({
              status: "failed",
              metadata: {
                ...(paymentOrder.metadata ?? {}),
                webhook_last_event: eventType,
              },
            })
            .eq("id", paymentOrder.id);

          if (updateOrderError) {
            return jsonResponse({ error: updateOrderError.message }, 500);
          }
        }
      }
    }

    const { error: markProcessedError } = await supabaseAdmin
      .from("payment_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider_event_id", eventId);

    if (markProcessedError) {
      return jsonResponse({ error: markProcessedError.message }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
