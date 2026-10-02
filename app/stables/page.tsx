import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { date, location } from "@/lib/format";

export const metadata = { title: "Stables" };

export default async function Stables({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("stables")
    .select("name, tagline, acres, location_city, location_region, location_country, specialties, launched_at, profiles(username)")
    .eq("launched", true)
    .order("launched_at", { ascending: false })
    .limit(200);
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,location_region.ilike.%${q.replace(/[%,()]/g, "")}%,location_country.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data: stables } = await query;

  return (
    <>
      <h1>Stable Directory</h1>
      <form className="row" style={{ marginBottom: 14 }}>
        <input name="q" defaultValue={q ?? ""} placeholder="Search by name or location" style={{ maxWidth: 320 }} />
        <button className="btn btn-small">Search</button>
      </form>
      {stables?.length ? (
        <div className="table-wrap">
          <table className="list">
            <thead>
              <tr>
                <th>Stable</th>
                <th>Owner</th>
                <th>Location</th>
                <th className="num">Acres</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {stables.map((s: any) => (
                <tr key={s.profiles?.username}>
                  <td>
                    <Link href={`/stables/${s.profiles?.username}`}>
                      <strong>{s.name}</strong>
                    </Link>
                    {s.tagline && <div className="small muted">{s.tagline}</div>}
                  </td>
                  <td>{s.profiles?.username}</td>
                  <td>{location(s)}</td>
                  <td className="num">{s.acres}</td>
                  <td className="nowrap">{date(s.launched_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No stables found.</div>
      )}
    </>
  );
}
