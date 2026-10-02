import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";

export const metadata = { title: "Associations" };

const SECTIONS = [
  ["breed", "Breed Registries", "Studbooks and breed associations. Every registered horse belongs to one."],
  ["discipline", "Show Circuits & Disciplines", "Circuits, sanctioning bodies, and discipline groups."],
  ["club", "Player Clubs", "Founded and run by players. Join one or charter your own."],
] as const;

export default async function Associations() {
  const supabase = await createClient();
  const [{ data: assocs }, { data: members }] = await Promise.all([
    supabase.from("associations").select("id, slug, name, abbreviation, kind, description, official, membership_fee, breeds(name)").order("official", { ascending: false }).order("name"),
    supabase.from("association_members").select("association_id"),
  ]);
  const counts = new Map<string, number>();
  members?.forEach((m: any) => counts.set(m.association_id, (counts.get(m.association_id) ?? 0) + 1));

  return (
    <>
      <div className="spread">
        <h1 className="mt0">Associations</h1>
        <Link href="/associations/new" className="btn btn-small">
          Charter an association
        </Link>
      </div>
      {SECTIONS.map(([kind, title, blurb]) => {
        const list = (assocs ?? []).filter((a: any) => a.kind === kind);
        return (
          <section key={kind}>
            <h2>{title}</h2>
            <p className="small muted">{blurb}</p>
            {list.length ? (
              <div className="table-wrap">
                <table className="list">
                  <tbody>
                    {list.map((a: any) => (
                      <tr key={a.id}>
                        <td style={{ width: 80 }}>
                          <strong>{a.abbreviation}</strong>
                        </td>
                        <td>
                          <Link href={`/associations/${a.slug}`}>
                            <strong>{a.name}</strong>
                          </Link>{" "}
                          {a.official && <span className="pill pill-gold">Official</span>}
                          {a.breeds?.length > 0 && (
                            <div className="small muted">{a.breeds.map((b: any) => b.name).join(" · ")}</div>
                          )}
                        </td>
                        <td className="small nowrap">{counts.get(a.id) ?? 0} members</td>
                        <td className="small nowrap">{a.membership_fee > 0 ? `${money(a.membership_fee)} dues` : "Free"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">None yet.</div>
            )}
          </section>
        );
      })}
    </>
  );
}
