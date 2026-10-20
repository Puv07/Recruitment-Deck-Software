// Edit these lists to change the dropdown choices in the Candidates module.
export const SOURCES = [
  "Job portal",
  "Referral",
  "Walk-in",
  "Social media",
  "Consultancy",
  "Campus",
  "Other",
];

export const MARITAL = ["Single", "Married", "Divorced", "Widowed", "Prefer not to say"];

// Suggestions only: the qualification box also accepts anything you type.
export const QUALIFICATION_HINTS = [
  "BPT", "MPT", "BSc", "MSc", "MBBS", "MD", "BDS", "MDS", "B.Com", "BBA", "MBA", "MSW", "Diploma", "12th", "Other",
];

export const CALL_OUTCOMES = [
  "Connected",
  "No answer",
  "Busy",
  "Switched off",
  "Wrong number",
  "Call back requested",
];

export const CALL_RESPONSES = ["Interested", "Not interested", "Thinking", "Needs more information", "Not applicable"];

// Candidate scorecard, based on the SPARRC interview evaluation form.
// Technical is out of 10 and the five HR criteria are out of 5 each, so the full scorecard is out of 35.
export const SCORE_CRITERIA = [
  { key: "technical_score", label: "Technical know-how", hint: "Role knowledge and the skills required for the applied position", max: 10, group: "functional" },
  { key: "communication_score", label: "Communication skills", hint: "Clarity, listening and language", max: 5, group: "hr" },
  { key: "attitude_score", label: "Attitude and trait towards work", hint: "Motivation, openness and teamwork", max: 5, group: "hr" },
  { key: "commitment_score", label: "Commitment for the organisation", hint: "Stability and seriousness about the role", max: 5, group: "hr" },
  { key: "grooming_score", label: "Grooming standard", hint: "Presentation and professional appearance", max: 5, group: "hr" },
  { key: "flexibility_score", label: "Flexibility to the firm", hint: "Shifts, locations and adapting to change", max: 5, group: "hr" },
] as const;

export type ScoreKey = (typeof SCORE_CRITERIA)[number]["key"];
export type ScoreValues = Partial<Record<ScoreKey, number | null>>;

export const SCORE_TOTAL_MAX: number = SCORE_CRITERIA.reduce((sum, c) => sum + c.max, 0);
export const SCORE_MAX = 5; // old setting, no longer used
export const ASSESSMENT_MAX = 40; // the Assessment-stage score is out of this number

const ANCHORS5: Record<number, string> = { 5: "Excellent", 4: "Good to excellent", 3: "Good", 2: "Fair to good", 1: "Fair", 0: "Poor" };
const ANCHORS10: Record<number, string> = { 10: "Excellent", 6: "Good", 2: "Fair", 0: "Poor" };

export function scoreOptions(max: number) {
  const anchors = max === 10 ? ANCHORS10 : ANCHORS5;
  const out: { value: number; label: string }[] = [];
  for (let v = max; v >= 0; v--) {
    out.push({ value: v, label: anchors[v] ? `${v} - ${anchors[v]}` : String(v) });
  }
  return out;
}

// The latest recorded value for each criterion, per candidate. Rows must be newest first.
export function currentScoresByCandidate<T extends { candidate_id: string } & ScoreValues>(rowsNewestFirst: T[]) {
  const map = new Map<string, ScoreValues>();
  for (const r of rowsNewestFirst) {
    const cur: ScoreValues = map.get(r.candidate_id) ?? {};
    for (const c of SCORE_CRITERIA) {
      const v = r[c.key];
      if (cur[c.key] == null && typeof v === "number") cur[c.key] = v;
    }
    map.set(r.candidate_id, cur);
  }
  return map;
}

export function profileStrength(values: ScoreValues) {
  let points = 0;
  let scoredMax = 0;
  let scored = 0;
  for (const c of SCORE_CRITERIA) {
    const v = values[c.key];
    if (typeof v === "number") {
      points += v;
      scoredMax += c.max;
      scored += 1;
    }
  }
  return {
    points,
    scoredMax,
    scored,
    total: SCORE_CRITERIA.length,
    percent: scoredMax > 0 ? (points / scoredMax) * 100 : null,
    complete: scored === SCORE_CRITERIA.length,
  };
}

export function hrSubtotal(values: ScoreValues) {
  const hr = SCORE_CRITERIA.filter((c) => c.group === "hr");
  const vals = hr.map((c) => values[c.key]);
  return {
    total: vals.reduce<number>((s, v) => s + (typeof v === "number" ? v : 0), 0),
    max: hr.reduce((s, c) => s + c.max, 0),
    complete: vals.every((v) => typeof v === "number"),
  };
}

export type Band = { grade: "A" | "B" | "C" | "D"; label: string };

// Grade guides taken from the evaluation form. They are guidance only.
export function functionalBand(technical: number | null | undefined): Band | null {
  if (typeof technical !== "number") return null;
  if (technical >= 8) return { grade: "A", label: "Selected" };
  if (technical >= 5) return { grade: "B", label: "Good to hire" };
  if (technical >= 2) return { grade: "C", label: "Hold" };
  return { grade: "D", label: "Reject" };
}

export function hrBand(total: number): Band {
  if (total >= 20) return { grade: "A", label: "Selected" };
  if (total >= 15) return { grade: "B", label: "Good to hire" };
  if (total >= 7) return { grade: "C", label: "Hold" };
  return { grade: "D", label: "Reject" };
}

// Where jobs are posted. Edit this list to match the channels you use.
export const POSTING_PLATFORMS = [
  "Naukri",
  "LinkedIn",
  "Indeed",
  "Apna",
  "WorkIndia",
  "Facebook",
  "Instagram",
  "WhatsApp group",
  "Company website",
  "Employee referral",
  "Walk-in drive",
  "Consultancy",
  "Other",
];

// Why a candidate leaves the pipeline. Edit this list to match your reasons.
export const DROP_REASONS = [
  "Salary expectation",
  "Location or distance",
  "Better offer elsewhere",
  "Not interested",
  "No response",
  "Skills gap",
  "Failed interview",
  "Communication",
  "Notice period too long",
  "Personal or family reasons",
  "Role mismatch",
  "Other",
];

// Reasons shown in the Stage feedback tab. Edit these lists freely.
export const FORWARD_REASONS = [
  "Meets all requirements",
  "Meets requirements, subject to conditions",
  "Strong communication",
  "Strong technical skills",
  "Good cultural fit",
  "Other",
];

export const HOLD_REASONS = [
  "Waiting for another candidate",
  "Waiting for vacancy approval",
  "Candidate unavailable",
  "Salary discussion pending",
  "Documents pending",
  "Other",
];

export type AssessmentScore = { score: number; max: number };

// The latest Assessment-stage score for each candidate. Rows must be newest first.
export function latestAssessmentScores<T extends { candidate_id: string; score: number | null; score_max: number | null }>(
  rowsNewestFirst: T[]
) {
  const map = new Map<string, AssessmentScore>();
  for (const r of rowsNewestFirst) {
    if (!map.has(r.candidate_id) && r.score !== null && r.score_max) {
      map.set(r.candidate_id, { score: Number(r.score), max: Number(r.score_max) });
    }
  }
  return map;
}

// One profile strength from the scorecard AND the assessment score together.
export function combinedStrength(values: ScoreValues, assessment: AssessmentScore | null | undefined) {
  const base = profileStrength(values);
  const aPoints = assessment ? assessment.score : 0;
  const aMax = assessment ? assessment.max : 0;
  const points = base.points + aPoints;
  const scoredMax = base.scoredMax + aMax;
  const scored = base.scored + (assessment ? 1 : 0);
  const total = base.total + 1;
  return {
    points,
    scoredMax,
    scored,
    total,
    totalMax: SCORE_TOTAL_MAX + ASSESSMENT_MAX,
    percent: scoredMax > 0 ? (points / scoredMax) * 100 : null,
    complete: scored === total,
    scorecard: base,
  };
}