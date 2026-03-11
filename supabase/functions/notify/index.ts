import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_URL = Deno.env.get("APP_URL") ?? "https://hisaabkitab.vercel.app";
const APP_NAME = "HisaabKitaab";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

interface NotifyPayload {
  type: "expense_added" | "settlement" | "group_invite" | "member_joined";
  recipientUserIds?: string[];   // existing users to notify in-app + email
  inviteEmail?: string;          // non-user: only send invite email
  inviterName?: string;
  title: string;
  body: string;
  groupId?: string;
  groupName?: string;
  expenseId?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Auth guard: require a valid user JWT ──────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const payload: NotifyPayload = await req.json();

    // 1. Insert in-app notifications for existing users
    if (payload.recipientUserIds && payload.recipientUserIds.length > 0) {
      const rows = payload.recipientUserIds.map((userId) => ({
        user_id: userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        related_group_id: payload.groupId ?? null,
        related_expense_id: payload.expenseId ?? null,
      }));

      const { error } = await supabaseAdmin.from("notifications").insert(rows);
      if (error) console.error("notification insert error:", error);

      // 2. Send email to each existing user (if Resend key is configured)
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        for (const userId of payload.recipientUserIds) {
          const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
          const email = data?.user?.email;
          if (email) {
            await sendEmail(resendKey, {
              to: email,
              subject: payload.title,
              body: payload.body,
              groupName: payload.groupName,
            });
          }
        }
      }
    }

    // 3. Send invite email to a non-user (no in-app notification possible yet)
    if (payload.inviteEmail) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        await sendInviteEmail(resendKey, {
          to: payload.inviteEmail,
          inviterName: payload.inviterName ?? "A friend",
          groupName: payload.groupName ?? "a group",
        });
      }
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

// ─── Email helpers ────────────────────────────────────────────
function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:sans-serif;">
<div style="max-width:520px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
    <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">🪙 ${APP_NAME}</h1>
  </div>
  <div style="padding:28px 32px;">
    ${content}
    <div style="margin-top:28px;">
      <a href="${APP_URL}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Open ${APP_NAME} →
      </a>
    </div>
  </div>
  <div style="padding:16px 32px;background:#f8f8f8;border-top:1px solid #eee;font-size:12px;color:#888;text-align:center;">
    You're receiving this because you're part of a group on ${APP_NAME}.
  </div>
</div>
</body>
</html>`;
}

async function sendEmail(
  apiKey: string,
  opts: { to: string; subject: string; body: string; groupName?: string },
) {
  const html = emailWrapper(`
    <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:18px;">${opts.subject}</h2>
    <p style="margin:0 0 8px;color:#444;line-height:1.6;">${opts.body}</p>
    ${opts.groupName ? `<p style="margin:8px 0 0;color:#888;font-size:13px;">Group: <strong>${opts.groupName}</strong></p>` : ""}
  `);

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${APP_NAME} <noreply@hisaabkitaab.app>`,
      to: opts.to,
      subject: opts.subject,
      html,
    }),
  });
}

async function sendInviteEmail(
  apiKey: string,
  opts: { to: string; inviterName: string; groupName: string },
) {
  const html = emailWrapper(`
    <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:18px;">You've been added to a group!</h2>
    <p style="margin:0 0 16px;color:#444;line-height:1.6;">
      <strong>${opts.inviterName}</strong> has added you to the group
      <strong>"${opts.groupName}"</strong> on ${APP_NAME} — India's smartest expense splitting app.
    </p>
    <p style="color:#444;line-height:1.6;">
      Sign up to see your shared expenses, track balances, and settle up via UPI.
      Your group membership is already waiting for you!
    </p>
    <a href="${APP_URL}/auth" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:8px;">
      Join ${APP_NAME} →
    </a>
  `);

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${APP_NAME} <noreply@hisaabkitaab.app>`,
      to: opts.to,
      subject: `${opts.inviterName} added you to "${opts.groupName}" on ${APP_NAME}`,
      html,
    }),
  });
}
