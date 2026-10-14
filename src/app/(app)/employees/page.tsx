import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EmployeesClient from "./EmployeesClient";
import type { Role } from "@/lib/nav";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [meRes, empRes, joinRes, offerRes, vacRes, centresRes, deptRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("employees").select("*").order("full_name").limit(2000),
    supabase
      .from("joining_records")
      .select("id, offer_id, candidate_name, joined_on")
      .is("employee_id", null)
      .order("joined_on"),
    supabase.from("offers").select("id, vacancy_id"),
    supabase.from("vacancies").select("id, title, centre_id, department_id"),
    supabase.from("centres").select("id, name").order("name"),
    supabase.from("departments").select("id, name").order("name"),
  ]);

  // Work out sensible starting values for each joiner without an employee record
  const pending = (joinRes.data ?? []).map((j) => {
    const offer = (offerRes.data ?? []).find((o) => o.id === j.offer_id);
    const vac = (vacRes.data ?? []).find((v) => v.id === offer?.vacancy_id);
    return {
      id: j.id,
      candidate_name: j.candidate_name,
      joined_on: j.joined_on,
      centre_id: vac?.centre_id ?? null,
      department_id: vac?.department_id ?? null,
      designation: vac?.title ?? "",
    };
  });

  return (
    <EmployeesClient
      role={(meRes.data?.role ?? "hr_executive") as Role}
      employees={empRes.data ?? []}
      pending={pending}
      centres={centresRes.data ?? []}
      departments={deptRes.data ?? []}
      loadError={empRes.error?.message ?? ""}
    />
  );
}