"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/nav";

type Offer = {
  id: string;
  candidate_id: string;
  candidate_name: string;
  vacancy_id: string | null;
  vacancy_title: string | null;
  proposed_compensation: number | null;
  issue_date: string | null;
  expiry_date: string | null;
  expected_joining_date: string | null;
  approval_status: string;
  offer_status: string;
  notes: string | null;
};
type Joining = {
  id: string;
  offer_id: string;
  joined_on: string;
  notes: string | null;
  confirmed_by: string;
  confirmed_at: string;
};
type CandLite = { id: string; full_name: string; status: string; vacancy_id: string | null };
type VacLite = { id: string; title: string };
type Person = { id: string; full_name: string | null; email: string | null };
type EventRow = { id: string; author_id: string; body: string; created_at: string };
type Msg = { ok: boolean; text: string } | null;

const APPROVALS = ["Draft", "Pending Approval", "Approved", "Rejected"];
const OFFER_STATUSES = ["Not Released", "Released", "Accepted", "Declined", "Expired", "Withdrawn"];
const CLOSED_STATUSES = ["Declined", "Expired", "Withdrawn"];

const APPROVAL_STYLE: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  "Pending Approval": "bg-yellow-50 text-yellow-700",
  Approved: "bg-green-50 text-green-700",
  Rejected: "bg-red-50 text-red-700",
};
const OFFER_STYLE: Record<string, string> = {
  "Not Released": "bg-slate-100 text-slate-600",
  Released: "bg-blue-50 text-blue-700",
  Accepted: "bg-green-50 text-green-700",
  Declined: "bg-red-50 text-red-700",
  Expired: "bg-slate-100 text-slate-500",
  Withdrawn: "bg-slate-100 text-slate-500",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

const money = (n: number | null) => (n == null ? "-" : n.toLocaleString("en-IN"));
const numOrNull = (v: string) => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export default function OffersClient({
  role,
  offers,
  joinings,
  candidates,
  vacancies,
  people,
  loadError,
}: {
  role: Role;
  offers: Offer[];
  joinings: Joining[];
  candidates: CandLite[];
  vacancies: VacLite[];
  people: Person[];
  loadError: string;
}) {
  const router = useRouter();
  const canEdit = ["super_admin", "hr_head", "recruitment_lead"].includes(role);
  const canApprove = ["super_admin", "hr_head"].includes(role);
  const canConfirm = ["super_admin", "hr_head", "recruitment_lead", "hr_operations"].includes(role);

  const [view, setView] = useState<"active" | "joined" | "closed" | "all">("active");
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-CA"));
  }, []);

  const joinedIds = new Set(joinings.map((j) => j.offer_id));
  const personName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };
  const isExpired = (o: Offer) =>
    !!today && o.offer_status === "Released" && !!o.expiry_date && o.expiry_date < today;

  const rows = offers.filter((o) => {
    const joined = joinedIds.has(o.id);
    const closed = CLOSED_STATUSES.includes(o.offer_status);
    if (view === "active" && (joined || closed)) return false;
    if (view === "joined" && !joined) return false;
    if (view === "closed" && !closed) return false;
    if (q && !o.candidate_name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const selected = offers.find((o) => o.id === selectedId) ?? null;
  const stats = {
    pending: offers.filter((o) => o.approval_status === "Pending Approval").length,
    awaiting: offers.filter((o) => o.offer_status === "Released").length,
    accepted: offers.filter((o) => o.offer_status === "Accepted" && !joinedIds.has(o.id)).length,
    joined: joinings.length,
  };

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Offers &amp; Joining</h1>
          <p className="mt-1 text-sm text-slate-500">
            Offer approval, status and joining confirmation. Nothing is sent from here.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> New offer
          </button>
        )}
      </div>

      {loadError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load offers: {loadError}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Awaiting approval", stats.pending],
          ["Released, awaiting response", stats.awaiting],
          ["Accepted, awaiting joining", stats.accepted],
          ["Joined", stats.joined],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(
            [
              ["active", "Active"],
              ["joined", "Joined"],
              ["closed", "Closed"],
              ["all", "All"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === key ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search candidate"
            className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {offers.length === 0
              ? "No offers yet. A candidate must be at the Selected stage before you can create an offer."
              : "No offers match these filters."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Candidate</th>
                <th className="px-4 py-2 font-medium">Vacancy</th>
                <th className="px-4 py-2 text-right font-medium">Compensation</th>
                <th className="px-4 py-2 font-medium">Approval</th>
                <th className="px-4 py-2 font-medium">Offer</th>
                <th className="px-4 py-2 font-medium">Expiry</th>
                <th className="px-4 py-2 font-medium">Expected joining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((o) => {
                const joined = joinings.find((j) => j.offer_id === o.id);
                return (
                  <tr key={o.id} onClick={() => setSelectedId(o.id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{o.candidate_name}</td>
                    <td className="px-4 py-3 text-slate-600">{o.vacancy_title ?? "-"}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{money(o.proposed_compensation)}</td>
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_STYLE[o.approval_status]}`}>
                        {o.approval_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {joined ? (
                        <span className="whitespace-nowrap rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Joined {joined.joined_on}
                        </span>
                      ) : (
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${OFFER_STYLE[o.offer_status]}`}>
                          {o.offer_status}
                        </span>
                      )}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 ${isExpired(o) ? "font-medium text-red-600" : "text-slate-600"}`}>
                      {o.expiry_date ?? "-"}
                      {isExpired(o) && " (passed)"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{o.expected_joining_date ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <NewOfferModal
          candidates={candidates.filter(
            (c) => c.status === "Selected" && !offers.some((o) => o.candidate_id === c.id && !CLOSED_STATUSES.includes(o.offer_status))
          )}
          vacancies={vacancies}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}
      {selected && (
        <OfferDrawer
          key={selected.id}
          offer={selected}
          joining={joinings.find((j) => j.offer_id === selected.id) ?? null}
          candidates={candidates}
          canEdit={canEdit}
          canApprove={canApprove}
          canConfirm={canConfirm}
          personName={personName}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function NewOfferModal({
  candidates,
  vacancies,
  onClose,
  onDone,
}: {
  candidates: CandLite[];
  vacancies: VacLite[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [candidateId, setCandidateId] = useState("");
  const [vacancyId, setVacancyId] = useState("");
  const [compensation, setCompensation] = useState("");
  const [issue, setIssue] = useState("");
  const [expiry, setExpiry] = useState("");
  const [joining, setJoining] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function pickCandidate(id: string) {
    setCandidateId(id);
    const c = candidates.find((x) => x.id === id);
    if (c?.vacancy_id) setVacancyId(c.vacancy_id);
  }

  async function save() {
    const cand = candidates.find((c) => c.id === candidateId);
    if (!cand) return;
    setSaving(true);
    setError("");
    const vac = vacancies.find((v) => v.id === vacancyId);
    const { data, error } = await supabase
      .from("offers")
      .insert({
        candidate_id: cand.id,
        candidate_name: cand.full_name,
        vacancy_id: vacancyId || null,
        vacancy_title: vac?.title ?? null,
        proposed_compensation: numOrNull(compensation),
        issue_date: issue || null,
        expiry_date: expiry || null,
        expected_joining_date: joining || null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setError(
        error?.code === "23505"
          ? "This candidate already has an active offer."
          : error?.code === "23514"
          ? "The expiry date cannot be before the issue date."
          : error?.message ?? "Could not create the offer."
      );
      setSaving(false);
      return;
    }
    await supabase.from("offer_events").insert({ offer_id: data.id, body: "Offer record created as Draft" });
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">New offer</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Candidate (Selected stage only)</label>
        <select value={candidateId} onChange={(e) => pickCandidate(e.target.value)} className={inputCls}>
          <option value="">Select a candidate</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
        {candidates.length === 0 && (
          <p className="mt-2 rounded-lg bg-yellow-50 p-2 text-xs text-yellow-800">
            No candidates are at the Selected stage. Open Candidates and move a candidate to Selected first.
          </p>
        )}

        <label className="mt-4 block text-sm font-medium text-slate-700">Vacancy</label>
        <select value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} className={inputCls}>
          <option value="">None</option>
          {vacancies.map((v) => (
            <option key={v.id} value={v.id}>{v.title}</option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium text-slate-700">Proposed compensation (monthly)</label>
        <input type="number" min={0} value={compensation} onChange={(e) => setCompensation(e.target.value)} className={inputCls} />

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Issue date</label>
            <input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Expiry date</label>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Expected joining</label>
            <input type="date" value={joining} onChange={(e) => setJoining(e.target.value)} className={inputCls} />
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />

        <p className="mt-3 text-xs text-slate-500">
          The offer starts as a Draft. It needs approval from HR Head or Super Admin before it can be released.
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !candidateId}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create offer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OfferDrawer({
  offer,
  joining,
  candidates,
  canEdit,
  canApprove,
  canConfirm,
  personName,
  onClose,
}: {
  offer: Offer;
  joining: Joining | null;
  candidates: CandLite[];
  canEdit: boolean;
  canApprove: boolean;
  canConfirm: boolean;
  personName: (id: string | null) => string;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const o = offer;

  const [events, setEvents] = useState<EventRow[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);

  const [compensation, setCompensation] = useState(o.proposed_compensation == null ? "" : String(o.proposed_compensation));
  const [issue, setIssue] = useState(o.issue_date ?? "");
  const [expiry, setExpiry] = useState(o.expiry_date ?? "");
  const [expected, setExpected] = useState(o.expected_joining_date ?? "");
  const [approval, setApproval] = useState(o.approval_status);
  const [offerStatus, setOfferStatus] = useState(o.offer_status);
  const [notes, setNotes] = useState(o.notes ?? "");

  const [joinedOn, setJoinedOn] = useState(o.expected_joining_date ?? "");
  const [joinNotes, setJoinNotes] = useState("");

  async function loadEvents() {
    const { data } = await supabase
      .from("offer_events")
      .select("id, author_id, body, created_at")
      .eq("offer_id", o.id)
      .order("created_at", { ascending: false });
    setEvents(data ?? []);
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const next = {
      proposed_compensation: numOrNull(compensation),
      issue_date: issue || null,
      expiry_date: expiry || null,
      expected_joining_date: expected || null,
      approval_status: approval,
      offer_status: offerStatus,
      notes: notes.trim() || null,
    };

    const changes: string[] = [];
    if ((o.proposed_compensation ?? null) !== next.proposed_compensation) changes.push("Compensation updated");
    if ((o.issue_date ?? "") !== (next.issue_date ?? "")) changes.push(`Issue date: ${o.issue_date ?? "none"} to ${next.issue_date ?? "none"}`);
    if ((o.expiry_date ?? "") !== (next.expiry_date ?? "")) changes.push(`Expiry date: ${o.expiry_date ?? "none"} to ${next.expiry_date ?? "none"}`);
    if ((o.expected_joining_date ?? "") !== (next.expected_joining_date ?? ""))
      changes.push(`Expected joining: ${o.expected_joining_date ?? "none"} to ${next.expected_joining_date ?? "none"}`);
    if (o.approval_status !== next.approval_status) changes.push(`Approval: ${o.approval_status} to ${next.approval_status}`);
    if (o.offer_status !== next.offer_status) changes.push(`Offer status: ${o.offer_status} to ${next.offer_status}`);
    if ((o.notes ?? "") !== (next.notes ?? "")) changes.push("Notes updated");

    if (changes.length === 0) {
      setMsg({ ok: false, text: "Nothing has changed." });
      setSaving(false);
      return;
    }

    const { data, error } = await supabase.from("offers").update(next).eq("id", o.id).select("id");
    if (error || !data || data.length === 0) {
      setMsg({
        ok: false,
        text:
          error?.code === "23514"
            ? "The expiry date cannot be before the issue date."
            : error?.message ?? "You do not have permission to change this offer.",
      });
      setSaving(false);
      return;
    }
    await supabase.from("offer_events").insert({ offer_id: o.id, body: changes.join("; ") });

    // Keep the candidate pipeline in step (never marks anyone as Joined)
    const cand = candidates.find((c) => c.id === o.candidate_id);
    const moveCandidate = async (from: string, to: string, note: string) => {
      const moved = await supabase.from("candidates").update({ status: to }).eq("id", o.candidate_id).select("id");
      if (moved.data && moved.data.length > 0) {
        await supabase.from("candidate_stage_history").insert({
          candidate_id: o.candidate_id,
          from_status: from,
          to_status: to,
          note,
        });
      }
    };
    if (o.offer_status !== "Released" && next.offer_status === "Released" && cand?.status === "Selected") {
      await moveCandidate("Selected", "Offer Released", "Offer released");
    }
    if (
      o.offer_status !== "Accepted" &&
      next.offer_status === "Accepted" &&
      cand &&
      ["Selected", "Offer Released"].includes(cand.status)
    ) {
      await moveCandidate(cand.status, "Offer Accepted", "Offer accepted by candidate");
    }

    await loadEvents();
    router.refresh();
    setMsg({ ok: true, text: "Saved." });
    setSaving(false);
  }

  async function confirmJoining() {
    if (!joinedOn) return;
    if (!window.confirm(`Confirm that ${o.candidate_name} has joined on ${joinedOn}? This cannot be undone.`)) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.rpc("confirm_joining", {
      p_offer_id: o.id,
      p_joined_on: joinedOn,
      p_notes: joinNotes.trim() || null,
    });
    if (error) {
      setMsg({ ok: false, text: error.message });
      setSaving(false);
      return;
    }
    await loadEvents();
    router.refresh();
    setMsg({ ok: true, text: "Joining confirmed. The employee record and onboarding come with the Employee Directory step." });
    setSaving(false);
  }

  const locked = !canEdit || !!joining;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{o.candidate_name}</h2>
            <p className="mt-1 text-xs text-slate-500">{o.vacancy_title ?? "No vacancy linked"}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Approval</label>
            <select disabled={locked} value={approval} onChange={(e) => setApproval(e.target.value)} className={inputCls}>
              {APPROVALS.map((a) => (
                <option key={a} disabled={!canApprove && (a === "Approved" || a === "Rejected") && a !== o.approval_status}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Offer status</label>
            <select disabled={locked} value={offerStatus} onChange={(e) => setOfferStatus(e.target.value)} className={inputCls}>
              {OFFER_STATUSES.map((s) => (
                <option key={s} disabled={(s === "Released" || s === "Accepted") && approval !== "Approved"}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!canApprove && (
          <p className="mt-1 text-xs text-slate-500">Only HR Head or Super Admin can approve or reject an offer.</p>
        )}
        {approval !== "Approved" && (
          <p className="mt-1 text-xs text-slate-500">Released and Accepted unlock once the offer is approved.</p>
        )}

        <label className="mt-3 block text-xs font-medium text-slate-500">Proposed compensation (monthly)</label>
        <input type="number" min={0} disabled={locked} value={compensation} onChange={(e) => setCompensation(e.target.value)} className={inputCls} />

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Issue date</label>
            <input type="date" disabled={locked} value={issue} onChange={(e) => setIssue(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Expiry date</label>
            <input type="date" disabled={locked} value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Expected joining</label>
            <input type="date" disabled={locked} value={expected} onChange={(e) => setExpected(e.target.value)} className={inputCls} />
          </div>
        </div>

        <label className="mt-3 block text-xs font-medium text-slate-500">Notes</label>
        <textarea disabled={locked} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />

        {!canEdit && (
          <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">Your role can view offers but not change them.</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Marking an offer Released records that you released it. The app does not send anything to the candidate. Offer letters can be attached once the Documents step is built.
        </p>

        {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

        {canEdit && !joining && (
          <button
            onClick={save}
            disabled={saving}
            className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        )}

        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Joining</h3>
          {joining ? (
            <div className="mt-2 text-sm text-slate-700">
              <p>Joined on {joining.joined_on}</p>
              <p className="mt-1 text-xs text-slate-500">
                Confirmed by {personName(joining.confirmed_by)} on {new Date(joining.confirmed_at).toLocaleString()}
              </p>
              {joining.notes && <p className="mt-1 text-slate-600">{joining.notes}</p>}
            </div>
          ) : o.offer_status === "Accepted" ? (
            canConfirm ? (
              <div className="mt-2">
                <p className="text-xs text-slate-500">
                  Confirm only when the candidate has actually joined. This marks them as Joined in the pipeline.
                </p>
                <label className="mt-3 block text-xs font-medium text-slate-500">Date joined</label>
                <input type="date" value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} className={inputCls} />
                <label className="mt-3 block text-xs font-medium text-slate-500">Notes (optional)</label>
                <input value={joinNotes} onChange={(e) => setJoinNotes(e.target.value)} className={inputCls} />
                <button
                  onClick={confirmJoining}
                  disabled={saving || !joinedOn}
                  className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Confirm candidate has joined
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Your role cannot confirm joining.</p>
            )
          ) : (
            <p className="mt-2 text-sm text-slate-500">Joining can be confirmed after the offer is Accepted.</p>
          )}
        </div>

        <h3 className="mt-6 text-sm font-semibold text-slate-900">History</h3>
        <ul className="mt-3 space-y-2">
          {events.length === 0 && <li className="text-sm text-slate-500">No history yet.</li>}
          {events.map((e) => (
            <li key={e.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p>{e.body}</p>
              <p className="mt-1 text-xs text-slate-400">
                {personName(e.author_id)} - {new Date(e.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}