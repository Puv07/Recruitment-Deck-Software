import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

const oneLine = (s: string | null | undefined, fallback = "-") => {
  const v = (s ?? "").replace(/\s+/g, " ").trim().slice(0, 150);
  return v || fallback;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

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

type Item = {
  offerId: string;
  name: string;
  position: string;
  branch: string;
  phone: string;
  email: string;
  recruiter: string;
};

function buildEmail(items: Item[], date: string, appUrl: string | null) {
  const when = prettyDate(date);
  const subject =
    items.length === 1
      ? oneLine(`Joining today: ${items[0].name} - ${items[0].position}, ${items[0].branch}`, "Joining today")
      : `Joining today: ${items.length} candidates (${when})`;

  const link = appUrl ? `${appUrl.replace(/\/+$/, "")}/offers` : null;

  const text =
    `Joining reminder for ${when}\n\n` +
    items
      .map(
        (it, i) =>
          `${i + 1}. ${it.name}\n   Position: ${it.position}\n   Branch: ${it.branch}\n   Phone: ${it.phone}\n   Email: ${it.email}\n   Recruiter: ${it.recruiter}`
      )
      .join("\n\n") +
    `\n\nAfter they report, please confirm joining in the HR system.` +
    (link ? `\n${link}` : "") +
    `\n\nThis is an automated reminder.`;

  const rows = items
    .map(
      (it) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0"><strong>${esc(it.name)}</strong><br><span style="color:#64748b">${esc(it.position)}</span></td>` +
        `<td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(it.branch)}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(it.phone)}<br><span style="color:#64748b">${esc(it.email)}</span></td>` +
        `<td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(it.recruiter)}</td></tr>`
    )
    .join("");

  const html =
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">` +
    `<h2 style="margin:0 0 12px">Joining reminder - ${esc(when)}</h2>` +
    `<table style="border-collapse:collapse;width:100%;max-width:640px"><thead><tr style="text-align:left;color:#64748b;font-size:12px">` +
    `<th style="padding:8px">Candidate</th><th style="padding:8px">Branch</th><th style="padding:8px">Contact</th><th style="padding:8px">Recruiter</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>` +
    `<p style="margin-top:16px">After they report, please confirm joining in the HR system.</p>` +
    (link ? `<p><a href="${esc(link)}">Open Offers &amp; Joining</a></p>` : "") +
    `<p style="color:#94a3b8;font-size:12px">This is an automated reminder.</p></div>`;

  return { subject, text, html };
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_APP_PASSWORD;
  const recipients = (process.env.REMINDER_TO ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const live = !!(smtpUser && smtpPass && recipients.length > 0);
  const fromName = oneLine(process.env.REMINDER_FROM_NAME, "SPARRC HR Reminders").replace(/["<>]/g, "");
  const appUrl = process.env.APP_URL || null;

  // A date override is allowed only in simulated mode, so a live run can never be pointed at another day
  const requested = new URL(req.url).searchParams.get("date");
  const date = !live && requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : istToday();
  const mode = live ? "live" : "simulated";

  const { data: offers, error } = await admin
    .from("offers")
    .select("id, candidate_id, candidate_name, vacancy_id, vacancy_title")
    .eq("offer_status", "Accepted")
    .eq("expected_joining_date", date);
  if (error) return NextResponse.json({ error: "Could not read offers" }, { status: 500 });

  const list = offers ?? [];
  if (list.length === 0) return NextResponse.json({ mode, date, reminders: 0, results: [] });

  const offerIds = list.map((o) => o.id);
  const candIds = Array.from(new Set(list.map((o) => o.candidate_id)));
  const vacIds = Array.from(new Set(list.map((o) => o.vacancy_id).filter((v): v is string => !!v)));

  const [joinedRes, sentRes, candRes, vacRes] = await Promise.all([
    admin.from("joining_records").select("offer_id").in("offer_id", offerIds),
    admin
      .from("reminder_log")
      .select("offer_id")
      .eq("kind", "joining_email")
      .eq("for_date", date)
      .eq("status", "sent")
      .in("offer_id", offerIds),
    admin.from("candidates").select("id, phone, email, position_applied, recruiter_id").in("id", candIds),
    vacIds.length
      ? admin.from("vacancies").select("id, centre_id").in("id", vacIds)
      : Promise.resolve({ data: [] as { id: string; centre_id: string }[] }),
  ]);

  const centreIds = Array.from(new Set((vacRes.data ?? []).map((v) => v.centre_id)));
  const recruiterIds = Array.from(
    new Set((candRes.data ?? []).map((c) => c.recruiter_id).filter((r): r is string => !!r))
  );
  const [centreRes, recruiterRes] = await Promise.all([
    centreIds.length
      ? admin.from("centres").select("id, name").in("id", centreIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    recruiterIds.length
      ? admin.from("profiles").select("id, full_name, email").in("id", recruiterIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
  ]);

  const joined = new Set((joinedRes.data ?? []).map((j) => j.offer_id));
  const alreadySent = new Set((sentRes.data ?? []).map((s) => s.offer_id));

  const results: { offerId: string; status: string; error?: string }[] = [];
  const items: Item[] = [];

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
    const rec = (recruiterRes.data ?? []).find((r) => r.id === cand?.recruiter_id);

    items.push({
      offerId: o.id,
      name: oneLine(o.candidate_name),
      position: oneLine(o.vacancy_title ?? cand?.position_applied, "Position not recorded"),
      branch: oneLine(centre?.name, "Branch not recorded"),
      phone: oneLine(cand?.phone, "Not recorded"),
      email: oneLine(cand?.email, "Not recorded"),
      recruiter: oneLine(rec?.full_name || rec?.email, "Not assigned"),
    });
  }

  if (items.length === 0) return NextResponse.json({ mode, date, reminders: 0, results });

  const mail = buildEmail(items, date, appUrl);

  if (!live) {
    return NextResponse.json({
      mode,
      date,
      note: "Simulated: no email was sent because the email settings are not complete.",
      reminders: items.length,
      subject: mail.subject,
      preview: mail.text,
      results: [...results, ...items.map((it) => ({ offerId: it.offerId, status: "simulated" }))],
    });
  }

  let sendOk = false;
  let messageId: string | null = null;
  let errorText: string | null = null;
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: smtpUser as string, pass: smtpPass as string },
      connectionTimeout: 15000,
      socketTimeout: 20000,
    });
    const info = await transporter.sendMail({
      from: `"${fromName}" <${smtpUser}>`,
      to: recipients.join(", "),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    sendOk = true;
    messageId = info.messageId ?? null;
  } catch (e) {
    errorText = (e instanceof Error ? e.message : "Email could not be sent").slice(0, 300);
  }

  await admin.from("reminder_log").insert(
    items.map((it) => ({
      kind: "joining_email",
      offer_id: it.offerId,
      for_date: date,
      channel: "email",
      status: sendOk ? "sent" : "failed",
      provider_message_id: sendOk ? messageId : null,
      error: sendOk ? null : errorText,
    }))
  );

  for (const it of items) {
    results.push(sendOk ? { offerId: it.offerId, status: "sent" } : { offerId: it.offerId, status: "failed", error: errorText ?? undefined });
  }

  return NextResponse.json({ mode, date, reminders: items.length, recipients: recipients.length, results });
}