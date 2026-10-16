import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SCORE_CRITERIA } from "@/lib/options";
import VacancyPipelineClient from "./VacancyPipelineClient";

const ALLOWED = ["super_admin", "hr_head", "recruitment_lead", "hr_executive"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VacancyPipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = meRes.data?.role ?? "hr_executive";
  if (!ALLOWED.includes(role)) redirect("/");

  const vacRes = await supabase
    .from("vacancies")
    .select("id, title, category_id, centre_id, positions, approval_status")
    .eq("id", id)
    .maybeSingle();
  if (!vacRes.data) notFound();
  const vacancy = vacRes.data;

  const [candRes, postRes, catRes, centreRes] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, full_name, phone, source, status, recruiter_id, followup_date, created_at")
      .eq("vacancy_id", id)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("job_postings")
      .select("id, platform, status, posted_on, expires_on, applications_received, posting_url")
      .eq("vacancy_id", id)
      .order("posted_on", { ascending: false }),
    supabase.from("job_categories").select("id, name, slug"),
    supabase.from("centres").select("id, name"),
  ]);

  const rawCands = candRes.data ?? [];
  const ids = rawCands.map((c) => c.id);

  const histRes = ids.length
    ? await supabase
        .from("candidate_stage_history")
        .select("candidate_id, created_at")
        .in("candidate_id", ids)
        .order("created_at", { ascending: false })
        .limit(10000)
    : { data: [] };
  const assessRes = ids.length
    ? await supabase
        .from("candidate_assessments")
        .select(
          "candidate_id, communication_score, flexibility_score, commitment_score, grooming_score, attitude_score, technical_score, created_at"
        )
        .in("candidate_id", ids)
        .order("created_at", { ascending: false })
        .limit(5000)
    : { data: [] };

  // When each candidate entered their current stage (newest history row first)
  const since: Record<string, string> = {};
  for (const h of histRes.data ?? []) {
    if (!(h.candidate_id in since)) since[h.candidate_id] = h.created_at;
  }

  // Latest average score per candidate
  const score: Record<string, number> = {};
  const seen = new Set<string>();
  for (const a of assessRes.data ?? []) {
    if (seen.has(a.candidate_id)) continue;
    seen.add(a.candidate_id);
    const vals = SCORE_CRITERIA.map((c) => a[c.key]).filter((v): v is number => typeof v === "number");
    if (vals.length) score[a.candidate_id] = vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  const category = (catRes.data ?? []).find((c) => c.id === vacancy.category_id) ?? null;
  const centre = (centreRes.data ?? []).find((c) => c.id === vacancy.centre_id) ?? null;

  return (
    <VacancyPipelineClient
      userId={user.id}
      canEdit
      vacancy={vacancy}
      categoryName={category?.name ?? "Uncategorised"}
      categorySlug={category?.slug ?? null}
      centreName={centre?.name ?? "-"}
      candidates={rawCands.map((c) => ({
        ...c,
        stage_since: since[c.id] ?? c.created_at,
        score: score[c.id] ?? null,
      }))}
      postings={postRes.data ?? []}
    />
  );
}