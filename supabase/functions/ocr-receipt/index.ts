/* eslint-disable */
// @ts-nocheck
/// <reference lib="deno.unstable" />

// Supabase Edge Function: OCR a receipt image and store the result in `public.receipts`
//
// Expected request body (JSON):
// {
//   "image_url": "https://.../path/to/image.jpg",
//   "expense_id": "optional-expense-uuid",
//   "currency": "optional currency code, e.g. USD"
// }
//
// This function is designed so you can plug in any external OCR provider.

import { createClient } from "jsr:@supabase/supabase-js@2";

type OcrRequest = {
  image_url?: string;
  expense_id?: string;
  currency?: string;
};

type OcrResponse = {
  text: string;
  total_amount: number | null;
  currency?: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const OCR_API_URL = Deno.env.get("OCR_API_URL") ?? "";
const OCR_API_KEY = Deno.env.get("OCR_API_KEY") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

async function callExternalOcr(imageUrl: string): Promise<OcrResponse> {
  if (!OCR_API_URL || !OCR_API_KEY) {
    // Fallback: no OCR provider configured, just save a stub entry
    return {
      text: "OCR provider not configured. Saved image URL only.",
      total_amount: null,
      currency: null,
    };
  }

  const resp = await fetch(OCR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OCR_API_KEY}`,
    },
    body: JSON.stringify({ image_url: imageUrl }),
  });

  if (!resp.ok) {
    console.error("OCR provider error", await resp.text());
    throw new Error("Failed to process OCR");
  }

  const data = (await resp.json()) as Partial<OcrResponse> & Record<string, unknown>;

  return {
    text: typeof data.text === "string" ? data.text : "",
    total_amount:
      typeof data.total_amount === "number"
        ? data.total_amount
        : null,
    currency: typeof data.currency === "string" ? data.currency : null,
  };
}

async function getUserIdFromAuthHeader(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();

  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);

  return user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as OcrRequest;

    if (!body.image_url) {
      return new Response(JSON.stringify({ error: "image_url is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ocrResult = await callExternalOcr(body.image_url);

    const { data, error } = await supabaseAdmin
      .from("receipts")
      .insert({
        expense_id: body.expense_id ?? null,
        image_url: body.image_url,
        ocr_text: ocrResult.text,
        total_amount: ocrResult.total_amount,
        currency: body.currency ?? ocrResult.currency ?? null,
        status: "processed",
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to insert receipt", error);
      return new Response(JSON.stringify({ error: "Failed to save receipt" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        receipt: data,
        ocr: {
          text: ocrResult.text,
          total_amount: ocrResult.total_amount,
          currency: ocrResult.currency,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

