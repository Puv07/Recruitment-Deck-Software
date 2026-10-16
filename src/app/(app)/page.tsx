import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

const RECRUITMENT_ROLES = ["super_admin", "hr_head", "recruitment_lead", "hr_executive"];
const OFFER_ROLES = ["super_admin", "hr_head", "recruitment_lead", "hr_operations"];

export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = meRes.data?.role ?? "hr_executive";

  const [candRes, joinedRes, assessRes, vacRes, postRes, taskRes, intRes, offRes, catRes, peopleRes] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("id, status, category_id, source, recruiter_id, location_applied, created_at")
        .limit(5000),
      supabase
        .from("candidate_stage_history")
        .select("candidate_id, created_at")
        .eq("to_status", "Joined")
        .limit(5000),
      supabase
        .from("candidate_assessments")
        .select(
          "candidate_id, communication_score, flexibility_score, commitment_score, grooming_score, attitude_score, technical_score, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("vacancies")
        .select("id, category_id, positions, approval_status, recruiter_id, target_joining_date, created_at")
        .limit(5000),
      supabase
        .from("job_postings")
        .select("id, category_id, platform, status, applications_received, cost, owner_id, posted_on")
        .limit(5000),
      supabase
        .from("tasks")
        .select("id, status, due_date, assigned_to, created_at, completed_at")
        .limit(5000),
      supabase.from("interviews").select("id, status, scheduled_at").limit(5000),
      supabase
        .from("offers")
        .select("id, candidate_id, offer_status, expected_joining_date, created_at")
        .limit(5000),
      supabase.from("job_categories").select("id, name").order("sort_order"),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

  return (
    <DashboardClient
      canSeeRecruitment={RECRUITMENT_ROLES.includes(role)}
      canSeeOffers={OFFER_ROLES.includes(role)}
      candidates={candRes.data ?? []}
      joinedEvents={joinedRes.data ?? []}
      assessments={assessRes.data ?? []}
      vacancies={vacRes.data ?? []}
      postings={postRes.data ?? []}
      tasks={taskRes.data ?? []}
      interviews={intRes.data ?? []}
      offers={offRes.data ?? []}
      categories={catRes.data ?? []}
      people={peopleRes.data ?? []}
    />
  );
}