import { combinedStrength, currentScoresByCandidate, latestAssessmentScores, type ScoreValues } from "@/lib/options";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
type Row = { candidate_id: string } & ScoreValues;
type FbRow = { candidate_id: string; score: number | null; score_max: number | null };

// Adds "days in stage" and the combined profile strength (a percentage) to each candidate.
export async function withScores<T extends { id: string; created_at: string; stage_changed_at: string | null }>(
  db: Db,
  cands: T[]
) {
  const rows: Row[] = [];
  const fbRows: FbRow[] = [];
  const ids = cands.map((c) => c.id);

  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    const [a, f] = await Promise.all([
      db
        .from("candidate_assessments")
        .select(
          "candidate_id, communication_score, flexibility_score, commitment_score, grooming_score, attitude_score, technical_score, created_at"
        )
        .in("candidate_id", part)
        .order("created_at", { ascending: false }),
      db
        .from("candidate_stage_feedback")
        .select("candidate_id, score, score_max, created_at")
        .in("candidate_id", part)
        .eq("stage", "Assessment")
        .not("score", "is", null)
        .order("created_at", { ascending: false }),
    ]);
    rows.push(...((a.data ?? []) as Row[]));
    fbRows.push(...((f.data ?? []) as FbRow[]));
  }

  const current = currentScoresByCandidate(rows);
  const assessment = latestAssessmentScores(fbRows);

  return cands.map((c) => ({
    ...c,
    stage_since: c.stage_changed_at ?? c.created_at,
    score: combinedStrength(current.get(c.id) ?? {}, assessment.get(c.id)).percent,
  }));
}