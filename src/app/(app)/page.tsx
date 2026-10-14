import { createClient } from "@/lib/supabase/server";

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: centres, error } = await supabase
    .from("centres")
    .select("id, name, city, state, is_sample")
    .order("name");

  const total = centres?.length ?? 0;
  const samples = centres?.filter((c) => c.is_sample).length ?? 0;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
      <p className="mt-1 text-sm text-slate-500">
        Live figures from your database. More widgets arrive as each module is built.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Centres" value={total} />
        <StatCard label="Sample centres" value={samples} hint="Demo data, removable later" />
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Centres</h2>
        </div>
        {error ? (
          <p className="p-5 text-sm text-red-600">Could not load centres: {error.message}</p>
        ) : total === 0 ? (
          <p className="p-5 text-sm text-slate-500">No centres yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-5 py-2 font-medium">City</th>
                <th className="px-5 py-2 font-medium">State</th>
                <th className="px-5 py-2 font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {centres!.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-5 py-3 text-slate-600">{c.city}</td>
                  <td className="px-5 py-3 text-slate-600">{c.state}</td>
                  <td className="px-5 py-3">
                    {c.is_sample && (
                      <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        Sample
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}