import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { HorseTable, HORSE_ROW_SELECT, type HorseRow } from "@/components/HorseTable";
import { date, location } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `${username}'s stable` };
}

export default async function StablePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  const viewer = await getViewer();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at, is_admin")
    .ilike("username", username.replace(/[%_]/g, "\\$&"))
    .maybeSingle();
  if (!profile) notFound();

  const [{ data: stable }, { data: horses }, { data: facilities }, { data: types }, { data: footings }, { data: features }, { data: memberships }, { data: shops }] =
    await Promise.all([
      supabase.from("stables").select("*").eq("owner_id", profile.id).single(),
      supabase.from("horses").select(HORSE_ROW_SELECT).eq("owner_id", profile.id).neq("status", "record").order("registered_name"),
      supabase.from("facilities").select("*").eq("owner_id", profile.id).order("created_at"),
      supabase.from("facility_types").select("kind, label"),
      supabase.from("footing_types").select("key, label"),
      supabase.from("facility_features").select("key, label"),
      supabase.from("association_members").select("role, associations(slug, name, abbreviation)").eq("profile_id", profile.id),
      supabase.from("shops").select("id, name").eq("owner_id", profile.id),
    ]);

  const typeLabel = Object.fromEntries((types ?? []).map((t: any) => [t.kind, t.label]));
  const footingLabel = Object.fromEntries((footings ?? []).map((t: any) => [t.key, t.label]));
  const featureLabel = Object.fromEntries((features ?? []).map((t: any) => [t.key, t.label]));
  const all = (horses ?? []) as unknown as HorseRow[];
  const living = all.filter((h) => h.status !== "deceased");
  const memorial = all.filter((h) => h.status === "deceased");
  const isMe = viewer?.id === profile.id;
  const totalStalls = (facilities ?? []).reduce((n: number, f: any) => n + (f.stalls ?? 0), 0);

  return (
    <>
      {stable.banner_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={stable.banner_url} alt="" className="banner" />
      )}
      <div className="spread">
        <div>
          <h1 className="mt0" style={{ marginBottom: 0 }}>
            {stable.launched ? stable.name : `${profile.username}'s (unopened) stable`}
          </h1>
          {stable.tagline && <p className="horse-sub">{stable.tagline}</p>}
        </div>
        {isMe && (
          <Link href="/stable" className="btn btn-small">
            Manage stable
          </Link>
        )}
      </div>

      <div className="sidebar-layout" style={{ marginTop: 12 }}>
        <div>
          {stable.description && <p className="prose">{stable.description}</p>}

          <h2>Horses ({living.length})</h2>
          <HorseTable horses={living} empty="No horses on the property yet." />

          <h2>Facilities</h2>
          {facilities?.length ? (
            <div className="table-wrap">
              <table className="list">
                <thead>
                  <tr>
                    <th>Facility</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Footing</th>
                    <th>Extras</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.map((f: any) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.name}</strong>
                        {f.description && <div className="small muted">{f.description}</div>}
                      </td>
                      <td>
                        {typeLabel[f.kind]}
                        {f.stalls > 0 && <div className="small muted">{f.stalls} stalls</div>}
                      </td>
                      <td>{f.dimensions}</td>
                      <td>{f.footing ? footingLabel[f.footing] : "—"}</td>
                      <td className="small">{f.features?.map((k: string) => featureLabel[k]).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No facilities built yet.</div>
          )}

          {memorial.length > 0 && (
            <>
              <h2>In Memoriam</h2>
              <HorseTable horses={memorial} />
            </>
          )}
        </div>

        <aside>
          <div className="box">
            <div className="box-title">The Farm</div>
            <div className="box-body">
              <dl className="facts">
                <dt>Location</dt>
                <dd>{location(stable)}</dd>
                {stable.terrain && (
                  <>
                    <dt>Terrain</dt>
                    <dd>{stable.terrain}</dd>
                  </>
                )}
                <dt>Land</dt>
                <dd>{stable.acres} acres</dd>
                <dt>Stalls</dt>
                <dd>{totalStalls}</dd>
                {stable.specialties && (
                  <>
                    <dt>Specialties</dt>
                    <dd>{stable.specialties}</dd>
                  </>
                )}
                <dt>Opened</dt>
                <dd>{stable.launched ? date(stable.launched_at) : "Not yet"}</dd>
              </dl>
            </div>
          </div>
          <div className="box">
            <div className="box-title">The Owner</div>
            <div className="box-body">
              {profile.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" style={{ width: 90, height: 90, objectFit: "cover", float: "right", marginLeft: 8 }} />
              )}
              <strong>{profile.display_name ?? profile.username}</strong>{" "}
              {profile.is_admin && <span className="pill pill-gold">Staff</span>}
              <div className="small muted">@{profile.username} · joined {date(profile.created_at)}</div>
              {profile.bio && <p className="small prose">{profile.bio}</p>}
              {!isMe && viewer && (
                <p className="small" style={{ clear: "both" }}>
                  <Link href={`/bank?to=${profile.username}`}>Send money</Link>
                </p>
              )}
            </div>
          </div>
          {(memberships?.length ?? 0) > 0 && (
            <div className="box">
              <div className="box-title">Associations</div>
              <div className="box-body small">
                {memberships!.map((m: any) => (
                  <div key={m.associations?.slug}>
                    <Link href={`/associations/${m.associations?.slug}`}>{m.associations?.name}</Link>
                    {m.role !== "member" && <span className="muted"> ({m.role})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(shops?.length ?? 0) > 0 && (
            <div className="box">
              <div className="box-title">Shops</div>
              <div className="box-body small">
                {shops!.map((s: any) => (
                  <div key={s.id}>
                    <Link href={`/shops/${s.id}`}>{s.name}</Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
