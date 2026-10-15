import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CandidatesClient from "./CandidatesClient";
import type { Role } from "@/lib/nav";

const ALLOWED = ["super_admin", "hr_head", "recruitment_lead", "hr_executive"];

export default async function CandidatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (meRes.data?.role ?? "hr_executive") as Role;
  if (!ALLOWED.includes(role)) redirect("/");

  const [candRes, vacRes, catRes, peopleRes, assessRes] = await Promise.all([
    supabase.from("candidates").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("vacancies").select("id, title, category_id").order("title"),
    supabase.from("job_categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase
      .from("candidate_assessments")
      .select(
        "candidate_id, communication_score, flexibility_score, commitment_score, grooming_score, attitude_score, technical_score, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  return (
    <CandidatesClient
      userId={user.id}
      candidates={candRes.data ?? []}
      vacancies={vacRes.data ?? []}
      categories={catRes.data ?? []}
      people={peopleRes.data ?? []}
      assessments={assessRes.data ?? []}
      loadError={candRes.error?.message ?? ""}
    />
  );
}