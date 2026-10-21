import { currentScoresByCandidate, profileStrength, type ScoreValues } from "@/lib/options";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
type Row = { candidate_id: string } & ScoreValues;

// Adds "days in stage" and the profile strength (scorecard only, as a percentage) to each candidate.
export async function withScores<T extends { id: string; created_at: string; stage_changed_at: string | null }>(
  db: Db,
  cands: T[]
) {
  const rows: Row[] = [];
  const ids = cands.map((c) => c.id);

  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await db
      .from("candidate_assessments")
      .select(
        "candidate_id, communication_score, flexibility_score, commitment_score, grooming_score, attitude_score, technical_score, created_at"
      )
      .in("candidate_id", ids.slice(i, i + 100))
      .order("created_at", { ascending: false });
    rows.push(...((data ?? []) as Row[]));
  }

  const current = currentScoresByCandidate(rows);

  return cands.map((c) => ({
    ...c,
    stage_since: c.stage_changed_at ?? c.created_at,
    score: profileStrength(current.get(c.id) ?? {}).percent,
  }));
}