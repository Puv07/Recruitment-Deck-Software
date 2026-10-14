import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OffersClient from "./OffersClient";
import type { Role } from "@/lib/nav";

export default async function OffersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [meRes, offersRes, joinRes, candRes, vacRes, peopleRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("offers").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("joining_records").select("*").limit(1000),
    supabase.from("candidates").select("id, full_name, status, vacancy_id").order("full_name").limit(1000),
    supabase.from("vacancies").select("id, title").order("title"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  return (
    <OffersClient
      role={(meRes.data?.role ?? "hr_executive") as Role}
      offers={offersRes.data ?? []}
      joinings={joinRes.data ?? []}
      candidates={candRes.data ?? []}
      vacancies={vacRes.data ?? []}
      people={peopleRes.data ?? []}
      loadError={offersRes.error?.message ?? ""}
    />
  );
}