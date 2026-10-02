import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { loadPedigree } from "@/lib/pedigree";
import { Flash, type SP } from "@/components/Flash";
import { HorseImage } from "@/components/HorseImage";
import { Pedigree } from "@/components/Pedigree";
import { StatBar } from "@/components/StatBar";
import { SubmitButton } from "@/components/SubmitButton";
import { ageUp, buyHorse, geld, offerHorse, setSale, setStatus, setStud } from "@/app/actions/horses";
import { ageLabel, breedingStatus, date, horseAge, money, regNumber, sexIcon, sexLabel } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("horses").select("registered_name").eq("id", id).maybeSingle();
  return { title: data?.registered_name ?? "Horse" };
}

const STATS = [
  ["speed", "Speed"],
  ["stamina", "Stamina"],
  ["agility", "Agility"],
  ["strength", "Strength"],
  ["intelligence", "Intelligence"],
  ["temperament", "Temperament"],
  ["conformation", "Conformation"],
] as const;

function placeLabel(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function HorsePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const { data: h } = await supabase
    .from("horses")
    .select(
      "*, breeds(name, associations(slug, abbreviation, name)), owner:profiles!horses_owner_id_fkey(username), breeder:profiles!horses_breeder_id_fkey(username)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!h) notFound();

  const [pedigree, { data: offspring }, { data: shows }, { data: history }, { data: agePrice }] = await Promise.all([
    loadPedigree(supabase, h, 3),
    supabase
      .from("horses")
      .select("id, registered_name, sex, birth_date, status, sire:sire_id(id, registered_name), dam:dam_id(id, registered_name)")
      .or(`sire_id.eq.${h.id},dam_id.eq.${h.id}`)
      .order("birth_date", { ascending: false }),
    supabase
      .from("show_entries")
      .select("id, class_name, place, forum_threads(id, title, show_date, show_status)")
      .eq("horse_id", h.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("horse_ownership")
      .select("id, how, price, created_at, from:profiles!horse_ownership_from_id_fkey(username), to:profiles!horse_ownership_to_id_fkey(username)")
      .eq("horse_id", h.id)
      .order("created_at"),
    supabase.from("price_list").select("amount").eq("key", "age_up").single(),
  ]);

  const isOwner = !!viewer && viewer.id === h.owner_id;
  const age = horseAge(h.birth_date, h.age_bonus_years);
  const realAge = horseAge(h.birth_date, 0);
  const breeding = breedingStatus(h);
  const statTotal = STATS.reduce((n, [k]) => n + (h[k] as number), 0);
  const assoc = h.breeds?.associations;
  const placed = (shows ?? []).filter((s: any) => s.place);

  return (
    <>
      <Flash sp={sp} />
      <div className="horse-head">
        <div>
          <HorseImage src={h.image_url} alt={h.registered_name} size="lg" />
          {h.status !== "active" && (
            <p className="center" style={{ marginTop: 8 }}>
              <span className="pill">{h.status === "record" ? "Record only · not on property" : h.status}</span>
            </p>
          )}
        </div>
        <div>
          <h1 className="horse-title">{h.registered_name}</h1>
          <p className="horse-sub">
            {h.barn_name && <>“{h.barn_name}” · </>}
            {regNumber(h.reg_number)}
            {h.is_foundation && <> · Foundation</>}
          </p>
          {h.blurb && <p className="blurb">{h.blurb}</p>}
          <dl className="facts">
            <dt>Breed</dt>
            <dd>
              {h.breeds?.name}
              {assoc && (
                <>
                  {" "}
                  · <Link href={`/associations/${assoc.slug}`}>{assoc.abbreviation ?? assoc.name}</Link>
                </>
              )}
            </dd>
            <dt>Sex</dt>
            <dd>
              {sexIcon(h.sex)} {sexLabel(h.sex)}
            </dd>
            <dt>Age</dt>
            <dd>
              {ageLabel(h.birth_date, h.age_bonus_years)}
              {h.age_bonus_years > 0 && <span className="muted small"> (aged up +{h.age_bonus_years})</span>}
            </dd>
            <dt>Foaled</dt>
            <dd>{date(h.birth_date)}</dd>
            {h.color && (
              <>
                <dt>Color</dt>
                <dd>{h.color}</dd>
              </>
            )}
            {h.markings && (
              <>
                <dt>Markings</dt>
                <dd>{h.markings}</dd>
              </>
            )}
            {h.height_hands && (
              <>
                <dt>Height</dt>
                <dd>{h.height_hands} hh</dd>
              </>
            )}
            {h.discipline && (
              <>
                <dt>Discipline</dt>
                <dd>{h.discipline}</dd>
              </>
            )}
            {h.personality && (
              <>
                <dt>Personality</dt>
                <dd>{h.personality}</dd>
              </>
            )}
            <dt>Owner</dt>
            <dd>{h.owner ? <Link href={`/stables/${h.owner.username}`}>{h.owner.username}</Link> : "—"}</dd>
            <dt>Breeder</dt>
            <dd>{h.breeder ? <Link href={`/stables/${h.breeder.username}`}>{h.breeder.username}</Link> : h.is_foundation ? "Foundation import" : "—"}</dd>
            <dt>Breeding</dt>
            <dd>
              <span className={`pill ${breeding.ok ? "pill-green" : ""}`}>{breeding.label}</span>
            </dd>
            <dt>Show record</dt>
            <dd>
              {shows?.length ?? 0} start{shows?.length === 1 ? "" : "s"} · {placed.filter((s: any) => s.place === 1).length} win
              {placed.filter((s: any) => s.place === 1).length === 1 ? "" : "s"}
            </dd>
          </dl>

          {h.for_sale && (
            <div className="box" style={{ marginTop: 14 }}>
              <div className="box-body spread">
                <span>
                  <span className="pill pill-gold">For sale</span> <strong className="big-number">{money(h.sale_price)}</strong>
                </span>
                {viewer && !isOwner && (
                  <form action={buyHorse}>
                    <input type="hidden" name="id" value={h.id} />
                    <SubmitButton confirm={`Buy ${h.registered_name} for ${money(h.sale_price)}?`}>Buy now</SubmitButton>
                  </form>
                )}
                {!viewer && <Link href={`/login?next=/horses/${h.id}`}>Log in to buy</Link>}
              </div>
            </div>
          )}
          {h.at_stud && (
            <div className="box" style={{ marginTop: 14 }}>
              <div className="box-body spread">
                <span>
                  <span className="pill pill-green">Standing at stud</span> fee <strong>{money(h.stud_fee)}</strong>
                </span>
                {viewer && (
                  <Link className="btn btn-brown btn-small" href={`/breeding?sire=${h.id}`}>
                    Book a mare
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <div className="box">
          <div className="box-title">
            Stats <span className="small muted">total {statTotal} / 700</span>
          </div>
          <div className="box-body">
            {STATS.map(([k, label]) => (
              <StatBar key={k} label={label} value={h[k] as number} />
            ))}
          </div>
        </div>
        <div className="box">
          <div className="box-title">About</div>
          <div className="box-body">
            {h.about ? <p className="prose mt0">{h.about}</p> : <p className="muted mt0">No story yet.</p>}
          </div>
        </div>
      </div>

      <h2>Pedigree</h2>
      <Pedigree gens={pedigree} />

      <div className="grid-2" style={{ marginTop: 18 }}>
        <div>
          <h2 className="mt0">Offspring ({offspring?.length ?? 0})</h2>
          {offspring?.length ? (
            <table className="list">
              <tbody>
                {offspring.map((o: any) => {
                  const mate = h.sex === "mare" ? o.sire : o.dam;
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/horses/${o.id}`}>{o.registered_name}</Link> {sexIcon(o.sex)}
                        <div className="small muted">
                          {new Date(o.birth_date).getUTCFullYear()} · x{" "}
                          {mate ? <Link href={`/horses/${mate.id}`}>{mate.registered_name}</Link> : "unknown"}
                        </div>
                      </td>
                      <td className="right small muted">{o.status === "record" ? "record" : o.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty">No foals on record.</div>
          )}
        </div>
        <div>
          <h2 className="mt0">Show record</h2>
          {shows?.length ? (
            <table className="list">
              <tbody>
                {shows.map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/forum/t/${s.forum_threads?.id}`}>{s.forum_threads?.title}</Link>
                      <div className="small muted">
                        {s.class_name}
                        {s.forum_threads?.show_date && <> · {date(s.forum_threads.show_date)}</>}
                      </div>
                    </td>
                    <td className="right nowrap">
                      {s.place ? (
                        <span className={`pill ${s.place === 1 ? "pill-gold" : ""}`}>{placeLabel(s.place)}</span>
                      ) : (
                        <span className="small muted">{s.forum_threads?.show_status === "results" ? "unplaced" : "entered"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Hasn’t shown yet.</div>
          )}
        </div>
      </div>

      <h2>Ownership history</h2>
      <table className="list small">
        <tbody>
          {history?.map((e: any) => (
            <tr key={e.id}>
              <td className="nowrap">{date(e.created_at)}</td>
              <td>
                {e.how === "created" && <>Imported by {e.to?.username}</>}
                {e.how === "foaled" && <>Registered as a foal by {e.to?.username}</>}
                {(e.how === "sale" || e.how === "transfer") && (
                  <>
                    {e.how === "sale" ? "Sold" : "Transferred"} from {e.from?.username ?? "—"} to {e.to?.username ?? "—"}
                    {e.price ? ` for ${money(e.price)}` : ""}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isOwner && (
        <>
          <h2>Owner’s corner</h2>
          <div className="grid-2">
            <div className="box">
              <div className="box-title">
                Listing <Link href={`/horses/${h.id}/edit`}>edit profile →</Link>
              </div>
              <div className="box-body stack" style={{ display: "grid", gap: 14 }}>
                {h.status !== "deceased" && (
                  <form action={setSale} className="row">
                    <input type="hidden" name="id" value={h.id} />
                    <label className="row small">
                      <input type="checkbox" name="for_sale" defaultChecked={h.for_sale} /> For sale at
                    </label>
                    <input name="sale_price" type="number" min={0} defaultValue={h.sale_price ?? ""} placeholder="$" style={{ width: 120 }} />
                    <SubmitButton className="btn btn-small">Save</SubmitButton>
                  </form>
                )}
                {h.sex === "stallion" && h.status !== "deceased" && (
                  <form action={setStud} className="row">
                    <input type="hidden" name="id" value={h.id} />
                    <label className="row small">
                      <input type="checkbox" name="at_stud" defaultChecked={h.at_stud} /> At stud for
                    </label>
                    <input name="stud_fee" type="number" min={0} defaultValue={h.stud_fee ?? ""} placeholder="$" style={{ width: 120 }} />
                    <SubmitButton className="btn btn-small">Save</SubmitButton>
                  </form>
                )}
                {h.sex === "mare" && breeding.ok && (
                  <Link className="btn btn-brown btn-small" style={{ justifySelf: "start" }} href={`/breeding?dam=${h.id}`}>
                    Breed {h.barn_name ?? "this mare"}
                  </Link>
                )}
                {realAge === 0 && h.age_bonus_years === 0 && (
                  <form action={ageUp} className="row">
                    <input type="hidden" name="id" value={h.id} />
                    <span className="small">Age up +3 years:</span>
                    <SubmitButton className="btn btn-small" name="pay" value="credit">
                      Use credit ({viewer!.ageCredits} left)
                    </SubmitButton>
                    <SubmitButton className="btn btn-small btn-brown" name="pay" value="cash">
                      Pay {money(agePrice?.amount)}
                    </SubmitButton>
                  </form>
                )}
              </div>
            </div>
            <div className="box">
              <div className="box-title">Transfer &amp; status</div>
              <div className="box-body" style={{ display: "grid", gap: 14 }}>
                {h.status !== "deceased" && (
                  <details>
                    <summary className="small">Send to another player (private sale or gift)</summary>
                    <form action={offerHorse} className="stack">
                      <input type="hidden" name="id" value={h.id} />
                      <div className="fields-2">
                        <div className="field">
                          <label>Their username</label>
                          <input name="to" required />
                        </div>
                        <div className="field">
                          <label>Price (0 = gift)</label>
                          <input name="price" type="number" min={0} defaultValue={0} />
                        </div>
                      </div>
                      <div className="field">
                        <label>Note</label>
                        <input name="note" maxLength={500} placeholder="As discussed on the forum!" />
                      </div>
                      <SubmitButton className="btn btn-small">Send offer</SubmitButton>
                    </form>
                  </details>
                )}
                {h.status !== "deceased" && (
                  <form action={setStatus} className="row">
                    <input type="hidden" name="id" value={h.id} />
                    <select name="status" defaultValue={h.status} style={{ maxWidth: 260 }}>
                      <option value="active">Active</option>
                      <option value="retired">Retired (still on the farm)</option>
                      <option value="record">Record only (off the property)</option>
                      <option value="deceased">Deceased</option>
                    </select>
                    <SubmitButton className="btn btn-small btn-ghost" confirm="Change this horse's status? Deceased is permanent.">
                      Update
                    </SubmitButton>
                  </form>
                )}
                {h.sex === "stallion" && (
                  <form action={geld}>
                    <input type="hidden" name="id" value={h.id} />
                    <SubmitButton className="btn btn-small btn-red" confirm={`Geld ${h.registered_name}? This can't be undone.`}>
                      Geld
                    </SubmitButton>
                  </form>
                )}
                {age < 3 && h.status === "active" && (
                  <p className="small muted mt0">Shows require age 3+. Breeding requires 3+.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
