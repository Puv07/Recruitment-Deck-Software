import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

const clean = (s: string | null | undefined, fallback = "-") => {
  const v = (s ?? "").replace(/\s+/g, " ").trim().slice(0, 150);
  return v || fallback;
};

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function prettyDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Body of the WhatsApp template (create the same text in Meta's template manager):
// Joining reminder: {{1}} is due to join today as {{2}} at {{3}} ({{4}}). Candidate contact: {{5}}. Please confirm joining in the HR system.
function previewText(p: string[]) {
  return `Joining reminder: ${p[0]} is due to join today as ${p[1]} at ${p[2]} (${p[3]}). Candidate contact: ${p[4]}. Please confirm joining in the HR system.`;
}

async function sendTemplate(opts: {
  version: string;
  phoneId: string;
  token: string;
  to: string;
  template: string;
  lang: string;
  params: string[];
}) {
  try {
    const res = await fetch(`https://graph.facebook.com/${opts.version}/${opts.phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: opts.to,
        type: "template",
        template: {
          name: opts.template,
          language: { code: opts.lang },
          components: [{ type: "body", parameters: opts.params.map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false as const, error: String(json?.error?.message ?? `HTTP ${res.status}`).slice(0, 300) };
    }
    return { ok: true as const, id: (json?.messages?.[0]?.id as string | undefined) ?? null };
  } catch {
    return { ok: false as const, error: "Network error while contacting WhatsApp" };
  }
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION;
  const to = (process.env.HR_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  const template = process.env.WHATSAPP_TEMPLATE_NAME || "joining_reminder";
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || "en";
  const live = !!(token && phoneId && version && to);

  // A date override is allowed only in simulated mode, so a live run can never be pointed at another day
  const requested = new URL(req.url).searchParams.get("date");
  const date = !live && requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : istToday();

  const { data: offers, error } = await admin
    .from("offers")
    .select("id, candidate_id, candidate_name, vacancy_id, vacancy_title")
    .eq("offer_status", "Accepted")
    .eq("expected_joining_date", date);
  if (error) return NextResponse.json({ error: "Could not read offers" }, { status: 500 });

  const list = offers ?? [];
  const mode = live ? "live" : "simulated";
  if (list.length === 0) return NextResponse.json({ mode, date, reminders: 0, results: [] });

  const offerIds = list.map((o) => o.id);
  const candIds = Array.from(new Set(list.map((o) => o.candidate_id)));
  const vacIds = Array.from(new Set(list.map((o) => o.vacancy_id).filter((v): v is string => !!v)));

  const [joinedRes, sentRes, candRes, vacRes] = await Promise.all([
    admin.from("joining_records").select("offer_id").in("offer_id", offerIds),
    admin
      .from("reminder_log")
      .select("offer_id")
      .eq("kind", "joining_whatsapp")
      .eq("for_date", date)
      .eq("status", "sent")
      .in("offer_id", offerIds),
    admin.from("candidates").select("id, phone, position_applied").in("id", candIds),
    vacIds.length
      ? admin.from("vacancies").select("id, centre_id").in("id", vacIds)
      : Promise.resolve({ data: [] as { id: string; centre_id: string }[] }),
  ]);

  const centreIds = Array.from(new Set((vacRes.data ?? []).map((v) => v.centre_id)));
  const centreRes = centreIds.length
    ? await admin.from("centres").select("id, name").in("id", centreIds)
    : { data: [] as { id: string; name: string }[] };

  const joined = new Set((joinedRes.data ?? []).map((j) => j.offer_id));
  const alreadySent = new Set((sentRes.data ?? []).map((s) => s.offer_id));

  const results: { offerId: string; status: string; message?: string; error?: string }[] = [];

  for (const o of list) {
    if (joined.has(o.id)) {
      results.push({ offerId: o.id, status: "skipped: joining already confirmed" });
      continue;
    }
    if (alreadySent.has(o.id)) {
      results.push({ offerId: o.id, status: "skipped: already sent" });
      continue;
    }
    const cand = (candRes.data ?? []).find((c) => c.id === o.candidate_id);
    const vac = (vacRes.data ?? []).find((v) => v.id === o.vacancy_id);
    const centre = (centreRes.data ?? []).find((c) => c.id === vac?.centre_id);

    const params = [
      clean(o.candidate_name),
      clean(o.vacancy_title ?? cand?.position_applied, "the role"),
      clean(centre?.name, "branch not recorded"),
      prettyDate(date),
      clean(cand?.phone, "not recorded"),
    ];

    if (!live) {
      results.push({ offerId: o.id, status: "simulated", message: previewText(params) });
      continue;
    }

    const sent = await sendTemplate({
      version: version as string,
      phoneId: phoneId as string,
      token: token as string,
      to,
      template,
      lang,
      params,
    });
    await admin.from("reminder_log").insert({
      kind: "joining_whatsapp",
      offer_id: o.id,
      for_date: date,
      channel: "whatsapp",
      status: sent.ok ? "sent" : "failed",
      provider_message_id: sent.ok ? sent.id : null,
      error: sent.ok ? null : sent.error,
    });
    results.push(sent.ok ? { offerId: o.id, status: "sent" } : { offerId: o.id, status: "failed", error: sent.error });
  }

  return NextResponse.json({ mode, date, reminders: results.length, results });
}