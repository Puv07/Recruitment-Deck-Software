"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DROP_REASONS, FORWARD_REASONS, HOLD_REASONS } from "@/lib/options";

type Decision = "Move forward" | "On hold" | "Reject";
type Entry = {
  id: string;
  stage: string;
  decision: Decision;
  reason: string | null;
  feedback: string | null;
  given_by: string;
  created_at: string;
};
type Msg = { ok: boolean; text: string } | null;

const STAGES = ["Applied", "HR Screening", "Assessment", "Technical Interview", "Final Interview"];
const DECISIONS: Decision[] = ["Move forward", "On hold", "Reject"];

const DECISION_STYLE: Record<Decision, string> = {
  "Move forward": "bg-green-50 text-green-700",
  "On hold": "bg-yellow-50 text-yellow-700",
  Reject: "bg-red-50 text-red-700",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

const nextOf = (stage: string) => STAGES[STAGES.indexOf(stage) + 1] ?? "Selected";
const targetFor = (d: Decision, stage: string) =>
  d === "Move forward" ? nextOf(stage) : d === "On hold" ? "On Hold" : "Rejected";
const labelFor = (d: Decision, stage: string) =>
  d === "Move forward"
    ? stage === "Final Interview"
      ? "Select candidate"
      : `Move forward to ${nextOf(stage)}`
    : d === "On hold"
    ? "On hold"
    : "Reject";
const reasonsFor = (d: Decision) => (d === "Move forward" ? FORWARD_REASONS : d === "On hold" ? HOLD_REASONS : DROP_REASONS);

export default function StageFeedback({
  candidate,
  personName,
  onChanged,
}: {
  candidate: { id: string; full_name: string; status: string };
  personName: (id: string | null) => string;
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState<string | null>(STAGES.includes(candidate.status) ? candidate.status : null);

  async function load() {
    const { data } = await supabase
      .from("candidate_stage_feedback")
      .select("id, stage, decision, reason, feedback, given_by, created_at")
      .eq("candidate_id", candidate.id)
      .order("created_at", { ascending: false });
    setEntries((data ?? []) as Entry[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id]);

  return (
    <div className="mt-4">
      <p className="text-xs text-slate-500">
        Record the decision after each stage and the reason for it. Feedback is kept as a record and cannot be edited or
        deleted. Add a new entry to change a decision.
      </p>

      <div className="mt-3 space-y-2">
        {STAGES.map((stage, i) => {
          const list = entries.filter((e) => e.stage === stage);
          const latest = list[0];
          const isCurrent = candidate.status === stage;
          const isOpen = open === stage;
          return (
            <div key={stage} className={`rounded-xl border ${isCurrent ? "border-indigo-300" : "border-slate-200"}`}>
              <button
                onClick={() => setOpen(isOpen ? null : stage)}
                className="flex w-full items-center justify-between gap-2 p-3 text-left"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {i + 1}. {stage}
                  {isCurrent && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">Current stage</span>
                  )}
                </span>
                {latest ? (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DECISION_STYLE[latest.decision]}`}>
                    {labelFor(latest.decision, stage)}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-slate-400">No feedback</span>
                )}
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 p-3">
                  <ul className="space-y-2">
                    {list.length === 0 && <li className="text-sm text-slate-500">No feedback recorded for this stage yet.</li>}
                    {list.map((e) => (
                      <li key={e.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DECISION_STYLE[e.decision]}`}>
                            {labelFor(e.decision, e.stage)}
                          </span>
                          {e.reason && <span className="text-xs text-slate-600">{e.reason}</span>}
                        </p>
                        {e.feedback && <p className="mt-1 whitespace-pre-wrap">{e.feedback}</p>}
                        <p className="mt-1 text-xs text-slate-400">
                          {personName(e.given_by)} - <span suppressHydrationWarning>{new Date(e.created_at).toLocaleString()}</span>
                        </p>
                      </li>
                    ))}
                  </ul>

                  <FeedbackForm
                    key={stage}
                    stage={stage}
                    candidate={candidate}
                    onSaved={async (moved) => {
                      await load();
                      if (moved) onChanged();
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeedbackForm({
  stage,
  candidate,
  onSaved,
}: {
  stage: string;
  candidate: { id: string; full_name: string; status: string };
  onSaved: (moved: boolean) => Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [decision, setDecision] = useState<Decision | "">("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [apply, setApply] = useState(true);
  const [msg, setMsg] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);

  const canApply = candidate.status === stage;
  const target = decision ? targetFor(decision, stage) : "";

  async function save() {
    if (!decision) return;
    setMsg(null);
    if (decision === "Reject" && !reason) {
      setMsg({ ok: false, text: "Please choose a reason for rejecting." });
      return;
    }
    const willMove = canApply && apply;
    if (willMove && !window.confirm(`Save this feedback and move ${candidate.full_name} to ${target}?`)) return;

    setSaving(true);
    const ins = await supabase.from("candidate_stage_feedback").insert({
      candidate_id: candidate.id,
      stage,
      decision,
      reason: reason || null,
      feedback: feedback.trim() || null,
    });
    if (ins.error) {
      setMsg({ ok: false, text: ins.error.message });
      setSaving(false);
      return;
    }

    let moved = false;
    if (willMove) {
      const upd = await supabase.from("candidates").update({ status: target }).eq("id", candidate.id).select("id");
      if (upd.error || !upd.data || upd.data.length === 0) {
        setMsg({
          ok: false,
          text: "The feedback was saved, but the candidate could not be moved. You can only move candidates you are allowed to edit.",
        });
        await onSaved(false);
        setSaving(false);
        return;
      }
      const hist = await supabase.from("candidate_stage_history").insert({
        candidate_id: candidate.id,
        from_status: candidate.status,
        to_status: target,
        note: `Feedback at ${stage}: ${labelFor(decision, stage)}${reason ? ` - ${reason}` : ""}`,
        reason: decision === "Move forward" ? null : reason || null,
      });
      moved = true;
      if (hist.error) {
        setMsg({ ok: false, text: "Saved and moved, but the stage history entry could not be saved." });
      }
    }

    setDecision("");
    setReason("");
    setFeedback("");
    if (!moved || !msg) setMsg({ ok: true, text: moved ? `Saved. Candidate moved to ${target}.` : "Feedback saved." });
    await onSaved(moved);
    setSaving(false);
  }

  return (
    <div className="mt-4 rounded-xl bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900">Add feedback for {stage}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {DECISIONS.map((d) => (
          <button
            key={d}
            onClick={() => {
              setDecision(d);
              setReason("");
            }}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              decision === d ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {labelFor(d, stage)}
          </button>
        ))}
      </div>

      {decision && (
        <>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            {decision === "Reject" ? "Reason for rejecting (required)" : decision === "On hold" ? "Reason for holding" : "Condition or reason"}
          </label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
            <option value="">{decision === "Reject" ? "Select a reason" : "Not specified"}</option>
            {reasonsFor(decision).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>

          <label className="mt-3 block text-xs font-medium text-slate-600">Feedback and comments</label>
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} className={inputCls} />

          {canApply ? (
            <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} className="mt-1 h-4 w-4" />
              <span>
                Also update the pipeline: move {candidate.full_name} to <strong>{target}</strong>
              </span>
            </label>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              {candidate.full_name} is currently at {candidate.status}, so this feedback is saved to {stage} only and the
              pipeline is not changed.
            </p>
          )}
        </>
      )}

      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

      <button
        onClick={save}
        disabled={saving || !decision}
        className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save feedback"}
      </button>
    </div>
  );
}