import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { joinAssociation, leaveAssociation, updateAssociation } from "@/app/actions/social";
import { Flash, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { date, money } from "@/lib/format";

export default async function AssociationPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SP }) {
  const { slug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const { data: a } = await supabase
    .from("associations")
    .select("*, breeds(id, name, origin, typical_height, description), founder:profiles!associations_founder_id_fkey(username)")
    .eq("slug", slug)
    .maybeSingle();
  if (!a) notFound();

  const breedIds = (a.breeds ?? []).map((b: any) => b.id);
  const [{ data: members }, { count: registered }] = await Promise.all([
    supabase
      .from("association_members")
      .select("role, joined_at, profile_id, profiles(username)")
      .eq("association_id", a.id)
      .order("joined_at"),
    breedIds.length
      ? supabase.from("horses").select("id", { count: "exact", head: true }).in("breed_id", breedIds).neq("status", "deceased")
      : Promise.resolve({ count: 0 }),
  ]);
  const isMember = !!viewer && (members ?? []).some((m: any) => m.profile_id === viewer.id);
  const isFounder = !!viewer && a.founder_id === viewer.id;

  return (
    <>
      <Flash sp={sp} />
      <h1 style={{ marginBottom: 0 }}>
        {a.name} {a.abbreviation && <span className="muted">({a.abbreviation})</span>}
      </h1>
      <p className="horse-sub">
        {a.official ? "Official Cavaletti association" : `Player-run · founded by ${a.founder?.username ?? "a former player"}`} · est.{" "}
        {date(a.created_at)}
      </p>
      <div className="sidebar-layout">
        <div>
          {a.description && <p className="prose">{a.description}</p>}
          {a.rules && (
            <>
              <h2>Rules</h2>
              <p className="prose">{a.rules}</p>
            </>
          )}
          {a.breeds?.length > 0 && (
            <>
              <h2>Breeds registered</h2>
              <table className="list">
                <thead>
                  <tr>
                    <th>Breed</th>
                    <th>Origin</th>
                    <th>Typical height</th>
                  </tr>
                </thead>
                <tbody>
                  {a.breeds.map((b: any) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.name}</strong>
                        <div className="small muted">{b.description}</div>
                      </td>
                      <td>{b.origin}</td>
                      <td>{b.typical_height}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted">{registered ?? 0} living horses registered.</p>
            </>
          )}
          {isFounder && (
            <details style={{ marginTop: 18 }}>
              <summary>President’s desk: edit association</summary>
              <form action={updateAssociation} className="stack">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="slug" value={a.slug} />
                <div className="field">
                  <label>Description</label>
                  <textarea name="description" defaultValue={a.description ?? ""} rows={5} />
                </div>
                <div className="field">
                  <label>Rules</label>
                  <textarea name="rules" defaultValue={a.rules ?? ""} rows={5} />
                </div>
                <div className="field">
                  <label>Dues</label>
                  <input name="fee" type="number" min={0} defaultValue={a.membership_fee} />
                </div>
                <SubmitButton className="btn btn-small">Save</SubmitButton>
              </form>
            </details>
          )}
        </div>
        <aside>
          <div className="box">
            <div className="box-title">Membership</div>
            <div className="box-body">
              <p className="mt0">
                Dues: <strong>{a.membership_fee > 0 ? money(a.membership_fee) : "Free"}</strong>
              </p>
              {viewer && !isMember && (
                <form action={joinAssociation}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="slug" value={a.slug} />
                  <SubmitButton className="btn btn-small">Join</SubmitButton>
                </form>
              )}
              {viewer && isMember && !isFounder && (
                <form action={leaveAssociation}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="slug" value={a.slug} />
                  <SubmitButton className="btn btn-small btn-ghost" confirm="Leave this association?">
                    Leave
                  </SubmitButton>
                </form>
              )}
              {!viewer && <Link href={`/login?next=/associations/${a.slug}`}>Log in to join</Link>}
            </div>
          </div>
          <div className="box">
            <div className="box-title">Members ({members?.length ?? 0})</div>
            <div className="box-body small">
              {members?.length ? (
                members.map((m: any) => (
                  <div key={m.profile_id}>
                    <Link href={`/stables/${m.profiles?.username}`}>{m.profiles?.username}</Link>
                    {m.role !== "member" && <span className="pill" style={{ marginLeft: 6 }}>{m.role}</span>}
                  </div>
                ))
              ) : (
                <span className="muted">No members yet.</span>
              )}
            </div>
          </div>
          <p className="small">
            <Link href="/forum/associations">Association business on the forum →</Link>
          </p>
        </aside>
      </div>
    </>
  );
}
