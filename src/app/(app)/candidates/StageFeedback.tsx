"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ASSESSMENT_MAX, DROP_REASONS, FORWARD_REASONS, HOLD_REASONS } from "@/lib/options";

type Decision = "Move forward" | "On hold" | "Reject";
type Entry = {
  id: string;
  stage: string;
  decision: Decision | null;
  reason: string | null;
  feedback: string | null;
  score: number | null;
  score_max: number | null;
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
const pct = (score: number, max: number) => `${Math.round((score / max) * 100)}%`;

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
      .select("id, stage, decision, reason, feedback, score, score_max, given_by, created_at")
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
        Record the decision after each stage and the reason for it. At the Assessment stage you can also record the
        assessment score. Feedback is kept as a record and cannot be edited or deleted. Add a new entry to change a decision.
      </p>

      <div className="mt-3 space-y-2">
        {STAGES.map((stage, i) => {
          const list = entries.filter((e) => e.stage === stage);
          const latestDecision = list.find((e) => e.decision);
          const latestScore = list.find((e) => e.score !== null && e.score_max);
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
                <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {latestScore && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {latestScore.score}/{latestScore.score_max} ({pct(latestScore.score as number, latestScore.score_max as number)})
                    </span>
                  )}
                  {latestDecision && latestDecision.decision ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DECISION_STYLE[latestDecision.decision]}`}>
                      {labelFor(latestDecision.decision, stage)}
                    </span>
                  ) : (
                    !latestScore && <span className="text-xs text-slate-400">No feedback</span>
                  )}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 p-3">
                  <ul className="space-y-2">
                    {list.length === 0 && <li className="text-sm text-slate-500">No feedback recorded for this stage yet.</li>}
                    {list.map((e) => (
                      <li key={e.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="flex flex-wrap items-center gap-2">
                          {e.decision && (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DECISION_STYLE[e.decision]}`}>
                              {labelFor(e.decision, e.stage)}
                            </span>
                          )}
                          {e.score !== null && e.score_max && (
                            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                              Score {e.score} / {e.score_max} ({pct(e.score, e.score_max)})
                            </span>
                          )}
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
                      onChanged();
                      return moved;
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
  onSaved: (moved: boolean) => Promise<boolean>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [decision, setDecision] = useState<Decision | "">("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState("");
  const [apply, setApply] = useState(true);
  const [msg, setMsg] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);

  const isAssessment = stage === "Assessment";
  const canApply = candidate.status === stage;
  const target = decision ? targetFor(decision, stage) : "";
  const scoreNum = isAssessment && score.trim() !== "" ? Number(score) : null;
  const scoreValid = scoreNum !== null && Number.isFinite(scoreNum) && scoreNum >= 0 && scoreNum <= ASSESSMENT_MAX;

  async function save() {
    setMsg(null);
    if (scoreNum !== null && !scoreValid) {
      setMsg({ ok: false, text: `The assessment score must be a number from 0 to ${ASSESSMENT_MAX}.` });
      return;
    }
    if (!decision && scoreNum === null) {
      setMsg({ ok: false, text: "Choose a decision, or enter an assessment score." });
      return;
    }
    if (decision === "Reject" && !reason) {
      setMsg({ ok: false, text: "Please choose a reason for rejecting." });
      return;
    }
    const willMove = !!decision && canApply && apply;
    if (willMove && !window.confirm(`Save this feedback and move ${candidate.full_name} to ${target}?`)) return;

    setSaving(true);
    const ins = await supabase.from("candidate_stage_feedback").insert({
      candidate_id: candidate.id,
      stage,
      decision: decision || null,
      reason: reason || null,
      feedback: feedback.trim() || null,
      score: scoreNum,
      score_max: scoreNum !== null ? ASSESSMENT_MAX : null,
    });
    if (ins.error) {
      setMsg({ ok: false, text: ins.error.message });
      setSaving(false);
      return;
    }

    let moved = false;
    let warn = "";
    if (willMove && decision) {
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
      if (hist.error) warn = " The stage history entry could not be saved.";
    }

    setDecision("");
    setReason("");
    setFeedback("");
    setScore("");
    setMsg({ ok: !warn, text: (moved ? `Saved. Candidate moved to ${target}.` : "Feedback saved.") + warn });
    await onSaved(moved);
    setSaving(false);
  }

  return (
    <div className="mt-4 rounded-xl bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900">Add feedback for {stage}</p>

      {isAssessment && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <label className="block text-xs font-medium text-slate-600">Assessment score (out of {ASSESSMENT_MAX})</label>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={ASSESSMENT_MAX}
              step="0.5"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <span className="text-sm text-slate-600">/ {ASSESSMENT_MAX}</span>
            <span className="text-lg font-semibold text-slate-900">
              {scoreNum !== null && scoreValid ? pct(scoreNum, ASSESSMENT_MAX) : "-"}
            </span>
          </div>
          {scoreNum !== null && scoreValid && (
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(scoreNum / ASSESSMENT_MAX) * 100}%` }} />
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">The percentage is calculated for you. You can save the score now and the decision later.</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {DECISIONS.map((d) => (
          <button
            key={d}
            onClick={() => {
              setDecision(decision === d ? "" : d);
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
        </>
      )}

      <label className="mt-3 block text-xs font-medium text-slate-600">Feedback and comments</label>
      <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} className={inputCls} />

      {decision &&
        (canApply ? (
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
        ))}

      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

      <button
        onClick={save}
        disabled={saving || (!decision && score.trim() === "")}
        className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save feedback"}
      </button>
    </div>
  );
}