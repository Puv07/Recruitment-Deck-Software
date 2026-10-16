"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DROP_REASONS, SCORE_MAX, SOURCES } from "@/lib/options";

type Vacancy = {
  id: string;
  title: string;
  category_id: string | null;
  centre_id: string;
  positions: number;
  approval_status: string;
};
type Cand = {
  id: string;
  full_name: string;
  phone: string | null;
  source: string | null;
  status: string;
  recruiter_id: string | null;
  followup_date: string | null;
  created_at: string;
  stage_since: string;
  score: number | null;
};
type Posting = {
  id: string;
  platform: string;
  status: string;
  posted_on: string;
  expires_on: string | null;
  applications_received: number;
  posting_url: string | null;
};
type Toast = { ok: boolean; text: string } | null;

   const QUALIFIED = [
     "Applied",
     "HR Screening",
     "Assessment",
     "Technical Interview",
     "Final Interview",
     "Selected",
     "Offer Released",
     "Offer Accepted",
     "Joined",
     "On Hold",
   ];
const DISQUALIFIED = ["Rejected", "Withdrawn", "Did Not Join"];
const OFFER_STAGES = ["Offer Released", "Offer Accepted"];
   const LOCKED_TARGETS = ["Offer Released", "Joined"];
const REASON_STAGES = ["Rejected", "Withdrawn", "Did Not Join", "On Hold"];
const REASON_REQUIRED = ["Rejected", "Withdrawn", "Did Not Join"];
const CLOSED = ["Joined", "Rejected", "Withdrawn", "Did Not Join"];

   const STAGE_COLOR: Record<string, string> = {
     Applied: "#64748b",
     "HR Screening": "#ec4899",
     Assessment: "#0ea5e9",
     "Technical Interview": "#f59e0b",
     "Final Interview": "#14b8a6",
     Selected: "#3b82f6",
     "Offer Released": "#8b5cf6",
     "Offer Accepted": "#6366f1",
     Joined: "#10b981",
     "On Hold": "#f97316",
     Rejected: "#ef4444",
     Withdrawn: "#94a3b8",
     "Did Not Join": "#a855f7",
   };

const AVATARS = [
  "bg-blue-100 text-blue-700",
  "bg-pink-100 text-pink-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
];

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

function avatarCls(name: string) {
  let h = 0;
  for (const ch of name) h += ch.charCodeAt(0);
  return AVATARS[h % AVATARS.length];
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
function ago(iso: string, nowMs: number | null) {
  if (nowMs === null) return "";
  const days = Math.floor((nowMs - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
function safeUrl(u: string | null) {
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:" ? p.href : null;
  } catch {
    return null;
  }
}

export default function VacancyPipelineClient({
  userId,
  canEdit,
  vacancy,
  categoryName,
  categorySlug,
  centreName,
  candidates,
  postings,
}: {
  userId: string;
  canEdit: boolean;
  vacancy: Vacancy;
  categoryName: string;
  categorySlug: string | null;
  centreName: string;
  candidates: Cand[];
  postings: Posting[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [cands, setCands] = useState<Cand[]>(candidates);
  const [tab, setTab] = useState<"pipeline" | "list" | "postings">("pipeline");
  const [view, setView] = useState<"qualified" | "disqualified">("qualified");
  const [q, setQ] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkTarget, setBulkTarget] = useState("HR Screening");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [pending, setPending] = useState<{ ids: string[]; target: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
     const [accepting, setAccepting] = useState<Cand | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => setCands(candidates), [candidates]);
  useEffect(() => setNow(Date.now()), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const today = now === null ? "" : new Date(now).toLocaleDateString("en-CA");
  const visible = cands.filter((c) => !q || c.full_name.toLowerCase().includes(q.toLowerCase()));
  const qualifiedCount = visible.filter((c) => QUALIFIED.includes(c.status)).length;
  const disqualifiedCount = visible.filter((c) => DISQUALIFIED.includes(c.status)).length;
     const stages = view === "qualified" ? [...QUALIFIED, "Rejected"] : DISQUALIFIED;

  const dragStrip =
    view === "qualified"
      ? { label: "Drop here to disqualify", targets: DISQUALIFIED }
      : { label: "Drop here to re-open", targets: ["Applied", "HR Screening", "Assessment"] };

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function runMove(ids: string[], target: string, reason: string | null, note: string | null) {
    const movers = cands.filter((c) => ids.includes(c.id) && c.status !== target && c.status !== "Joined");
    if (movers.length === 0) return;

    const before = new Map(movers.map((c) => [c.id, { status: c.status, since: c.stage_since }]));
    const nowIso = new Date().toISOString();
    setCands((list) => list.map((c) => (before.has(c.id) ? { ...c, status: target, stage_since: nowIso } : c)));

    const noteText = [reason, note].filter(Boolean).join(" - ") || null;
    const failed: string[] = [];
    let historyMissed = 0;

    await Promise.all(
      movers.map(async (c) => {
        const { data, error } = await supabase.from("candidates").update({ status: target }).eq("id", c.id).select("id");
        if (error || !data || data.length === 0) {
          failed.push(c.id);
          return;
        }
        const h = await supabase.from("candidate_stage_history").insert({
          candidate_id: c.id,
          from_status: c.status,
          to_status: target,
          note: noteText,
          reason,
        });
        if (h.error) historyMissed += 1;
      })
    );

    if (failed.length > 0) {
      setCands((list) =>
        list.map((c) => {
          const b = before.get(c.id);
          return failed.includes(c.id) && b ? { ...c, status: b.status, stage_since: b.since } : c;
        })
      );
    }

    const done = movers.length - failed.length;
    if (failed.length > 0) {
      setToast({
        ok: false,
        text: `${failed.length} candidate(s) could not be moved. You can only move candidates you own or are allowed to edit.`,
      });
    } else if (historyMissed > 0) {
      setToast({ ok: false, text: `Moved, but the history entry could not be saved for ${historyMissed} candidate(s).` });
    } else {
      setToast({ ok: true, text: `Moved ${done} candidate${done === 1 ? "" : "s"} to ${target}.` });
    }
    setSelected([]);
    router.refresh();
  }

  function attemptMove(ids: string[], target: string) {
    if (!canEdit) return;
           if (target === "Offer Accepted") {
         if (ids.length !== 1) {
           setToast({ ok: false, text: "Move candidates to Offer Accepted one at a time, so each gets a joining date." });
           return;
         }
         const only = cands.find((c) => c.id === ids[0]);
         if (only && only.status !== "Offer Accepted") setAccepting(only);
         return;
       }
    if (LOCKED_TARGETS.includes(target)) {
      setToast({
        ok: false,
        text: `${target} is managed in Offers & Joining, so approval and joining confirmation are not skipped.`,
      });
      return;
    }
    const movers = cands.filter((c) => ids.includes(c.id) && c.status !== target);
    if (movers.length === 0) return;
    if (movers.some((c) => c.status === "Joined")) {
      setToast({ ok: false, text: "A candidate who has joined cannot be moved." });
      return;
    }
    const hasOffer = movers.some((c) => OFFER_STAGES.includes(c.status));
    if (REASON_STAGES.includes(target) || hasOffer) {
      setPending({ ids: movers.map((c) => c.id), target });
      return;
    }
    runMove(
      movers.map((c) => c.id),
      target,
      null,
      null
    );
  }

  function handleDrop(target: string) {
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    if (id) attemptMove([id], target);
  }

  const pendingNames = pending ? cands.filter((c) => pending.ids.includes(c.id)).map((c) => c.full_name) : [];
  const pendingHasOffer = pending ? cands.some((c) => pending.ids.includes(c.id) && OFFER_STAGES.includes(c.status)) : false;

  return (
    <div className="mx-auto max-w-full p-4 md:p-8">
      <Link
        href={categorySlug ? `/recruitment/${categorySlug}` : "/recruitment"}
        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {categoryName} vacancies
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{vacancy.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {centreName} - {categoryName} - {vacancy.positions} {vacancy.positions === 1 ? "position" : "positions"} -{" "}
            <span className="font-medium text-slate-700">{vacancy.approval_status}</span>
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add candidate
          </button>
        )}
      </div>

      <div className="mt-5 flex gap-6 border-b border-slate-200">
        {(
          [
            ["pipeline", "Pipeline"],
            ["list", `Candidates (${cands.length})`],
            ["postings", `Job postings (${postings.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 pb-2 text-sm font-medium ${
              tab === key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pipeline" && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                onClick={() => setView("qualified")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                  view === "qualified" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Qualified ({qualifiedCount})
              </button>
              <button
                onClick={() => setView("disqualified")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                  view === "disqualified" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Disqualified ({disqualifiedCount})
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search candidates"
                  className="w-52 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              {canEdit && (
                <button
                  onClick={() => {
                    setSelectMode((m) => !m);
                    setSelected([]);
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    selectMode ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Select mode
                </button>
              )}
            </div>
          </div>

          {dragId && canEdit && (
            <div className="mt-3 rounded-xl border-2 border-dashed border-slate-300 bg-white p-3">
              <p className="text-xs font-medium text-slate-500">{dragStrip.label}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dragStrip.targets.map((t) => (
                  <div
                    key={t}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverStage(`strip:${t}`);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(t);
                    }}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                      overStage === `strip:${t}` ? "bg-indigo-100 ring-2 ring-indigo-300" : "bg-slate-100"
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STAGE_COLOR[t] }} />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-3 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const items = visible.filter((c) => c.status === stage);
              const locked = LOCKED_TARGETS.includes(stage);
              const isOver = dragId !== null && overStage === stage;
              return (
                <div
                  key={stage}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    setOverStage(stage);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(stage);
                  }}
                  className={`w-64 shrink-0 rounded-xl p-2 transition ${
                    isOver ? (locked ? "bg-red-50 ring-2 ring-red-300" : "bg-indigo-50 ring-2 ring-indigo-300") : "bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: STAGE_COLOR[stage] }} />
                    <p className="flex-1 truncate text-sm font-semibold text-slate-800">{stage}</p>
                    {locked && <Lock className="h-3.5 w-3.5 text-slate-400" aria-label="Managed in Offers & Joining" />}
                    <span className="text-xs text-slate-500">{items.length}</span>
                  </div>
                  {isOver && locked && (
                    <p className="px-2 pb-1 text-xs text-red-600">Managed in Offers &amp; Joining</p>
                  )}
                  <div className="min-h-16 space-y-2">
                    {items.length === 0 && !dragId && <p className="px-2 py-3 text-xs text-slate-400">No candidates</p>}
                    {items.map((c) => {
                      const isSel = selected.includes(c.id);
                      const draggable = canEdit && !selectMode && c.status !== "Joined";
                      const followDue =
                        !!c.followup_date && !!today && c.followup_date <= today && !CLOSED.includes(c.status);
                      return (
                        <div
                          key={c.id}
                          draggable={draggable}
                          onDragStart={(e) => {
                            setDragId(c.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", c.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverStage(null);
                          }}
                          onClick={() => selectMode && toggle(c.id)}
                          className={`rounded-lg border bg-white p-3 shadow-sm ${
                            draggable ? "cursor-grab active:cursor-grabbing" : ""
                          } ${selectMode ? "cursor-pointer" : ""} ${
                            isSel ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200 hover:border-indigo-300"
                          } ${dragId === c.id ? "opacity-40" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarCls(
                                c.full_name
                              )}`}
                            >
                              {initials(c.full_name)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{c.full_name}</p>
                              <Link
                                href={`/candidates?open=${c.id}`}
                                draggable={false}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-medium text-blue-600 hover:underline"
                              >
                                View profile
                              </Link>
                            </div>
                            {selectMode && (
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={() => toggle(c.id)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Select ${c.full_name}`}
                                className="mt-1 h-4 w-4"
                              />
                            )}
                            {!selectMode && c.status === "Joined" && (
                              <Lock className="mt-1 h-3.5 w-3.5 text-slate-300" aria-label="Joined candidates cannot be moved" />
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-slate-400">{ago(c.stage_since, now)}</span>
                            <span className="flex items-center gap-1.5">
                              {followDue && <span className="font-medium text-red-600">Follow-up due</span>}
                              {c.score !== null && (
                                <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700">
                                  {c.score.toFixed(1)}/{SCORE_MAX}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-400">
            Drag a card to another column to change its stage. On a phone or without a mouse, use Select mode. Offer
            Released, Offer Accepted and Joined are managed in Offers &amp; Joining. Days show how long each candidate has
            been in their current stage.
          </p>
        </>
      )}

      {tab === "list" && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {cands.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No candidates are linked to this vacancy yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">In stage</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cands.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/candidates?open=${c.id}`} className="font-medium text-indigo-700 hover:underline">
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-slate-700">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STAGE_COLOR[c.status] }} />
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ago(c.stage_since, now)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.source ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.score === null ? "-" : `${c.score.toFixed(1)} / ${SCORE_MAX}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "postings" && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {postings.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No job postings are linked to this vacancy. Add one in{" "}
              <Link href="/postings" className="font-medium text-indigo-600 hover:underline">
                Job Postings
              </Link>
              .
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Platform</th>
                  <th className="px-4 py-2 font-medium">Posted</th>
                  <th className="px-4 py-2 font-medium">Expires</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Applications</th>
                  <th className="px-4 py-2 font-medium">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {postings.map((p) => {
                  const link = safeUrl(p.posting_url);
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{p.platform}</td>
                      <td className="px-4 py-3 text-slate-600">{p.posted_on}</td>
                      <td className="px-4 py-3 text-slate-600">{p.expires_on ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{p.status}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{p.applications_received}</td>
                      <td className="px-4 py-3">
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                            Open
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectMode && selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[95vw] flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
          <span className="text-sm font-medium text-slate-800">{selected.length} selected</span>
          <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            {[...QUALIFIED, ...DISQUALIFIED]
                 .filter((s) => !LOCKED_TARGETS.includes(s) && s !== "Offer Accepted")
              .map((s) => (
                <option key={s}>{s}</option>
              ))}
          </select>
          <button
            onClick={() => attemptMove(selected, bulkTarget)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Move
          </button>
          <button onClick={() => setSelected([])} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Clear
          </button>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-20 left-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 rounded-xl px-4 py-3 text-sm shadow-lg ${
            toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.text}
        </div>
      )}

      {pending && (
        <MoveModal
          target={pending.target}
          names={pendingNames}
          hasOffer={pendingHasOffer}
          onCancel={() => setPending(null)}
          onConfirm={(reason, note) => {
            const p = pending;
            setPending(null);
            runMove(p.ids, p.target, reason, note);
          }}
        />
      )}

               {accepting && (
           <AcceptOfferModal
             candidate={accepting}
             onClose={() => setAccepting(null)}
             onDone={() => {
               setToast({ ok: true, text: `${accepting.full_name} moved to Offer Accepted. A joining reminder is scheduled.` });
               setAccepting(null);
               router.refresh();
             }}
           />
         )}
      {showAdd && (
        <QuickAddModal
          userId={userId}
          vacancy={vacancy}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function MoveModal({
  target,
  names,
  hasOffer,
  onCancel,
  onConfirm,
}: {
  target: string;
  names: string[];
  hasOffer: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | null, note: string | null) => void;
}) {
  const required = REASON_REQUIRED.includes(target);
  const showReason = REASON_STAGES.includes(target);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Move to {target}</h2>
          <button onClick={onCancel} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`}
        </p>

        {hasOffer && (
          <p className="mt-3 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800">
            At least one of these candidates has an offer. Moving them here does not change the offer. Update or close it
            in Offers &amp; Joining as well.
          </p>
        )}

        {showReason && (
          <>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Reason{required ? "" : " (optional)"}
            </label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
              <option value="">Select a reason</option>
              {DROP_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </>
        )}

        <label className="mt-4 block text-sm font-medium text-slate-700">Note (optional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputCls} />

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason || null, note.trim() || null)}
            disabled={required && !reason}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickAddModal({
  userId,
  vacancy,
  onClose,
  onDone,
}: {
  userId: string;
  vacancy: Vacancy;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    const { data, error } = await supabase
      .from("candidates")
      .insert({
        full_name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        source: source || null,
        vacancy_id: vacancy.id,
        category_id: vacancy.category_id,
        position_applied: vacancy.title,
        recruiter_id: userId,
        status: "Applied",
      })
      .select("id")
      .single();
    if (error || !data) {
      setError(error?.message ?? "Could not add the candidate.");
      setSaving(false);
      return;
    }
    await supabase
      .from("candidate_stage_history")
      .insert({ candidate_id: data.id, from_status: null, to_status: "Applied", note: "Candidate added" });
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add candidate</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">For {vacancy.title}. Add the full details later from the Candidates page.</p>

        <label className="mt-4 block text-sm font-medium text-slate-700">Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
              <option value="">Select</option>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="mt-3 block text-sm font-medium text-slate-700">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add candidate"}
          </button>
        </div>
      </div>
    </div>
  );
}
function AcceptOfferModal({
  candidate,
  onClose,
  onDone,
}: {
  candidate: Cand;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [offer, setOffer] = useState<
    { id: string; offer_status: string; approval_status: string; expected_joining_date: string | null } | null | undefined
  >(undefined);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("offers")
      .select("id, offer_status, approval_status, expected_joining_date")
      .eq("candidate_id", candidate.id)
      .not("offer_status", "in", "(Declined,Expired,Withdrawn)")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setOffer(data ?? null);
        if (data?.expected_joining_date) setDate(data.expected_joining_date);
      });
    return () => {
      active = false;
    };
  }, [candidate.id, supabase]);

  async function confirm() {
    if (!offer || !date) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.rpc("accept_offer", { p_offer_id: offer.id, p_joining_date: date });
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    onDone();
  }

  let problem = "";
  if (offer === null) {
    problem =
      "No active offer was found for this candidate, or your role cannot see offers. Create and approve the offer in Offers & Joining first.";
  } else if (offer && offer.approval_status !== "Approved") {
    problem = "This offer is not approved yet. Get it approved in Offers & Joining first.";
  } else if (offer && offer.offer_status !== "Released") {
    problem = `This offer is ${offer.offer_status}. Mark it Released in Offers & Joining before recording that it was accepted.`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Offer accepted</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600">{candidate.full_name}</p>

        {offer === undefined && <p className="mt-4 text-sm text-slate-500">Checking the offer...</p>}

        {problem && (
          <>
            <p className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">{problem}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Close
              </button>
              <Link href="/offers" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Open Offers &amp; Joining
              </Link>
            </div>
          </>
        )}

        {offer && !problem && (
          <>
            <label className="mt-4 block text-sm font-medium text-slate-700">Date of joining</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <p className="mt-2 text-xs text-slate-500">
              HR gets a reminder on this date with the candidate&apos;s details and branch. Joining itself is still confirmed
              separately in Offers &amp; Joining.
            </p>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={saving || !date}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Confirm accepted"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}