import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withScores } from "@/lib/pipeline";
import PipelineClient, { type Scope } from "../PipelineClient";

const ALLOWED = ["super_admin", "hr_head", "recruitment_lead", "hr_executive"];
const CAND_COLUMNS =
  "id, full_name, phone, source, status, recruiter_id, followup_date, created_at, vacancy_id, position_applied, location_applied, stage_changed_at";

export default async function CategoryPipelinePage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(meRes.data?.role ?? "")) redirect("/");

  const [catRes, vacRes] = await Promise.all([
    supabase.from("job_categories").select("id, name, slug"),
    supabase.from("vacancies").select("id, title, category_id").order("title"),
  ]);
  const categories = catRes.data ?? [];
  const allVacs = vacRes.data ?? [];

  let scope: Scope;
  let vacancies = allVacs;
  let candQuery = supabase.from("candidates").select(CAND_COLUMNS).order("created_at", { ascending: false }).limit(1000);
  let postQuery = supabase.from("job_postings").select("*").order("posted_on", { ascending: false }).limit(500);
  let afterFilter: ((c: { vacancy_id: string | null }) => boolean) | null = null;

  if (category === "all") {
    scope = {
      kind: "all",
      title: "All candidates",
      subtitle: "Every role category in one pipeline.",
      slug: "all",
      categoryName: null,
      categoryId: null,
      vacancyId: null,
    };
  } else if (category === "uncategorised") {
    vacancies = allVacs.filter((v) => !v.category_id);
    const categorisedIds = new Set(allVacs.filter((v) => v.category_id).map((v) => v.vacancy_id ?? v.id));
    scope = {
      kind: "uncategorised",
      title: "Uncategorised",
      subtitle: "Candidates and vacancies with no role category. Set a category to move them into the right place.",
      slug: "uncategorised",
      categoryName: null,
      categoryId: null,
      vacancyId: null,
    };
    candQuery = candQuery.is("category_id", null);
    postQuery = postQuery.is("category_id", null);
    afterFilter = (c) => !c.vacancy_id || !categorisedIds.has(c.vacancy_id);
  } else {
    const found = categories.find((c) => c.slug === category);
    if (!found) notFound();
    vacancies = allVacs.filter((v) => v.category_id === found.id);
    const ids = vacancies.map((v) => v.id);
    scope = {
      kind: "category",
      title: found.name,
      subtitle: `Candidates for ${found.name} roles, across all vacancies.`,
      slug: found.slug,
      categoryName: found.name,
      categoryId: found.id,
      vacancyId: null,
    };
    const candFilter = ids.length
      ? `category_id.eq.${found.id},vacancy_id.in.(${ids.join(",")})`
      : `category_id.eq.${found.id}`;
    candQuery = candQuery.or(candFilter);
    postQuery = postQuery.or(candFilter);
  }

  const [candRes, postRes] = await Promise.all([candQuery, postQuery]);
  let raw = candRes.data ?? [];
  if (afterFilter) raw = raw.filter(afterFilter);
  const candidates = await withScores(supabase, raw);

  return (
    <PipelineClient
      userId={user.id}
      canEdit
      scope={scope}
      candidates={candidates}
      vacancies={vacancies}
      postings={postRes.data ?? []}
    />
  );
}