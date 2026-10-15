import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ApprovalsClient from "./ApprovalsClient";
import type { Role } from "@/lib/nav";

const ALLOWED = ["super_admin", "hr_head", "recruitment_lead", "hr_operations", "centre_manager"];

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (meRes.data?.role ?? "hr_executive") as Role;
  if (!ALLOWED.includes(role)) redirect("/");

  const [vacRes, offerRes, manRes, decRes, centresRes, peopleRes] = await Promise.all([
    supabase
      .from("vacancies")
      .select("id, title, centre_id, positions, priority, salary_range, created_by, updated_at")
      .eq("approval_status", "Pending Approval"),
    supabase
      .from("offers")
      .select("id, candidate_name, vacancy_title, proposed_compensation, expected_joining_date, created_by, updated_at")
      .eq("approval_status", "Pending Approval"),
    supabase
      .from("manpower_positions")
      .select("id, centre_id, designation, additional_requested, justification, created_by, updated_at")
      .eq("additional_status", "Pending"),
    supabase.from("approvals").select("*").order("decided_at", { ascending: false }).limit(50),
    supabase.from("centres").select("id, name"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  return (
    <ApprovalsClient
      role={role}
      vacancies={vacRes.data ?? []}
      offers={offerRes.data ?? []}
      manpower={manRes.data ?? []}
      decisions={decRes.data ?? []}
      centres={centresRes.data ?? []}
      people={peopleRes.data ?? []}
    />
  );
}