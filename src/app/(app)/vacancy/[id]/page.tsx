import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withScores } from "@/lib/pipeline";
import PipelineClient, { type Scope } from "../../PipelineClient";

const ALLOWED = ["super_admin", "hr_head", "recruitment_lead", "hr_executive"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAND_COLUMNS =
  "id, full_name, phone, source, status, recruiter_id, followup_date, created_at, vacancy_id, position_applied, location_applied, stage_changed_at";

export default async function VacancyPipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(meRes.data?.role ?? "")) redirect("/");

  const vacRes = await supabase
    .from("vacancies")
    .select("id, title, category_id, centre_id, positions, approval_status")
    .eq("id", id)
    .maybeSingle();
  if (!vacRes.data) notFound();
  const v = vacRes.data;

  const [candRes, postRes, catRes, centreRes] = await Promise.all([
    supabase.from("candidates").select(CAND_COLUMNS).eq("vacancy_id", id).order("created_at", { ascending: false }).limit(1000),
    supabase.from("job_postings").select("*").eq("vacancy_id", id).order("posted_on", { ascending: false }),
    supabase.from("job_categories").select("id, name, slug"),
    supabase.from("centres").select("id, name"),
  ]);

  const cat = (catRes.data ?? []).find((c) => c.id === v.category_id) ?? null;
  const centre = (centreRes.data ?? []).find((c) => c.id === v.centre_id) ?? null;
  const candidates = await withScores(supabase, candRes.data ?? []);

  const scope: Scope = {
    kind: "vacancy",
    title: v.title,
    subtitle: `${centre?.name ?? "-"} - ${cat?.name ?? "Uncategorised"} - ${v.positions} ${
      v.positions === 1 ? "position" : "positions"
    } - ${v.approval_status}`,
    slug: cat?.slug ?? "uncategorised",
    categoryName: cat?.name ?? "Uncategorised",
    categoryId: v.category_id,
    vacancyId: v.id,
  };

  return (
    <PipelineClient
      userId={user.id}
      canEdit
      scope={scope}
      candidates={candidates}
      vacancies={[{ id: v.id, title: v.title, category_id: v.category_id }]}
      postings={postRes.data ?? []}
    />
  );
}