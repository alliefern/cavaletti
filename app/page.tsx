import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { HorseImage } from "@/components/HorseImage";
import { ageLabel, dateTime, location, money, sexLabel } from "@/lib/format";

export default async function Home() {
  const supabase = await createClient();
  const viewer = await getViewer();

  const [{ data: news }, { data: forSale }, { data: stables }, { data: recentThreads }, { count: playerCount }, { count: horseCount }] =
    await Promise.all([
      supabase
        .from("forum_threads")
        .select("id, title, created_at, forum_categories!inner(slug)")
        .eq("forum_categories.slug", "announcements")
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("horses")
        .select("id, registered_name, sex, birth_date, age_bonus_years, image_url, sale_price, breeds(name)")
        .eq("for_sale", true)
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("stables")
        .select("name, location_city, location_region, location_country, launched_at, acres, profiles(username)")
        .eq("launched", true)
        .order("launched_at", { ascending: false })
        .limit(6),
      supabase
        .from("forum_threads")
        .select("id, title, last_post_at, kind, forum_categories(name)")
        .order("last_post_at", { ascending: false })
        .limit(8),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("horses").select("id", { count: "exact", head: true }).in("status", ["active", "retired"]),
    ]);

  return (
    <>
      <section className="hero">
        <div>
          <h1>Welcome to Cavaletti</h1>
          <p>
            The horse sim your 2004 self would’ve stayed up past bedtime for. Buy land, build a barn you’d actually
            want to muck, breed bloodlines that go back generations, and run the shows yourselves on the forum.
          </p>
          {viewer ? (
            <p className="row">
              <Link href="/dashboard" className="btn">
                Go to My Barn
              </Link>
              <Link href="/forum" className="btn btn-brown">
                Hit the Forum
              </Link>
            </p>
          ) : (
            <p className="row">
              <Link href="/signup" className="btn">
                Start your stable free
              </Link>
              <Link href="/login" className="btn btn-ghost">
                Log in
              </Link>
            </p>
          )}
        </div>
        <div className="hero-card">
          <strong>How Cavaletti works</strong>
          <ul>
            <li>Start with <strong>$50,000</strong> and 1 age-up credit</li>
            <li>Buy land: <strong>1 acre per horse</strong>, minimum</li>
            <li>Time runs 1:1. Your horse ages when you do</li>
            <li>Breed live or retroactively. Pedigrees are forever</li>
            <li>Sales, shows, and gossip happen on the forum</li>
          </ul>
          <p className="small muted" style={{ marginBottom: 0 }}>
            {playerCount ?? 0} players · {horseCount ?? 0} horses on the ground
          </p>
        </div>
      </section>

      <div className="sidebar-layout">
        <div>
          <div className="box">
            <div className="box-title">
              Fresh on the Market <Link href="/market">see all →</Link>
            </div>
            <div className="box-body">
              {forSale?.length ? (
                <div className="horse-grid">
                  {forSale.map((h: any) => (
                    <Link key={h.id} href={`/horses/${h.id}`} className="horse-card">
                      <HorseImage src={h.image_url} alt={h.registered_name} />
                      <div className="hc-body">
                        <div className="hc-name">{h.registered_name}</div>
                        <div className="small muted">
                          {h.breeds?.name} · {sexLabel(h.sex)} · {ageLabel(h.birth_date, h.age_bonus_years)}
                        </div>
                        <div>
                          <strong>{money(h.sale_price)}</strong>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty">Nothing listed yet. Somebody’s gotta go first.</div>
              )}
            </div>
          </div>

          <div className="box">
            <div className="box-title">
              On the Forum <Link href="/forum">enter →</Link>
            </div>
            <div className="box-body">
              <table className="list">
                <tbody>
                  {recentThreads?.map((t: any) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/forum/t/${t.id}`}>{t.title}</Link>
                        <div className="small muted">{t.forum_categories?.name}</div>
                      </td>
                      <td className="small muted right nowrap">{dateTime(t.last_post_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside>
          <div className="box">
            <div className="box-title">Barn Bulletin</div>
            <div className="box-body">
              {news?.map((n: any) => (
                <p key={n.id} className="mt0">
                  <Link href={`/forum/t/${n.id}`}>{n.title}</Link>
                  <br />
                  <span className="small muted">{dateTime(n.created_at)}</span>
                </p>
              ))}
            </div>
          </div>
          <div className="box">
            <div className="box-title">
              Newest Stables <Link href="/stables">all →</Link>
            </div>
            <div className="box-body">
              {stables?.length ? (
                stables.map((s: any) => (
                  <p key={s.profiles?.username} className="mt0">
                    <Link href={`/stables/${s.profiles?.username}`}>{s.name}</Link>
                    <br />
                    <span className="small muted">
                      {location(s)} · {s.acres} ac
                    </span>
                  </p>
                ))
              ) : (
                <p className="muted small">No stables yet. Be the first barn on the map.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
