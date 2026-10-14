import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ManpowerClient from "./ManpowerClient";
import type { Role } from "@/lib/nav";

export default async function ManpowerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [meRes, posRes, centresRes, deptRes, peopleRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("manpower_positions").select("*").order("created_at"),
    supabase.from("centres").select("id, name").order("name"),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  return (
    <ManpowerClient
      role={(meRes.data?.role ?? "hr_executive") as Role}
      positions={posRes.data ?? []}
      centres={centresRes.data ?? []}
      departments={deptRes.data ?? []}
      people={peopleRes.data ?? []}
      loadError={posRes.error?.message ?? ""}
    />
  );
}