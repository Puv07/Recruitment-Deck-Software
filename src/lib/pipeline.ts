import { SCORE_CRITERIA } from "@/lib/options";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

// Adds "days in stage" and the latest average score to each candidate.
export async function withScores<T extends { id: string; created_at: string; stage_changed_at: string | null }>(
  db: Db,
  cands: T[]
) {
  const score = new Map<string, number>();
  const seen = new Set<string>();
  const ids = cands.map((c) => c.id);

  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    const { data } = await db
      .from("candidate_assessments")
      .select(
        "candidate_id, communication_score, flexibility_score, commitment_score, grooming_score, attitude_score, technical_score, created_at"
      )
      .in("candidate_id", part)
      .order("created_at", { ascending: false });

    for (const a of data ?? []) {
      if (seen.has(a.candidate_id)) continue;
      seen.add(a.candidate_id);
      const vals = SCORE_CRITERIA.map((c) => a[c.key]).filter((v): v is number => typeof v === "number");
      if (vals.length) score.set(a.candidate_id, vals.reduce((s, v) => s + v, 0) / vals.length);
    }
  }

  return cands.map((c) => ({
    ...c,
    stage_since: c.stage_changed_at ?? c.created_at,
    score: score.get(c.id) ?? null,
  }));
}