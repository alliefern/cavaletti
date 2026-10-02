import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { Flash, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import {
  buildFacility,
  buyLand,
  demolishFacility,
  editFacility,
  launchStable,
  sellLand,
  updateStable,
  upgradeFacility,
} from "@/app/actions/stable";
import { money } from "@/lib/format";

export const metadata = { title: "Manage stable" };

export default async function ManageStable({ searchParams }: { searchParams: SP }) {
  const viewer = await requireViewer("/stable");
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: stable }, { data: prices }, { data: types }, { data: footings }, { data: features }, { data: facilities }, { count: horseCount }] =
    await Promise.all([
      supabase.from("stables").select("*").eq("owner_id", viewer.id).single(),
      supabase.from("price_list").select("key, amount"),
      supabase.from("facility_types").select("*").order("sort"),
      supabase.from("footing_types").select("*").order("sort"),
      supabase.from("facility_features").select("*").order("sort"),
      supabase.from("facilities").select("*").eq("owner_id", viewer.id).order("created_at"),
      supabase.from("horses").select("id", { count: "exact", head: true }).eq("owner_id", viewer.id).in("status", ["active", "retired"]),
    ]);

  const price = Object.fromEntries((prices ?? []).map((p: any) => [p.key, Number(p.amount)]));
  const typeMap = Object.fromEntries((types ?? []).map((t: any) => [t.kind, t]));
  const footingMap = Object.fromEntries((footings ?? []).map((f: any) => [f.key, f]));
  const featureMap = Object.fromEntries((features ?? []).map((f: any) => [f.key, f.label]));

  if (!stable.launched) {
    return (
      <div style={{ maxWidth: 680 }}>
        <h1>Launch your stable</h1>
        <Flash sp={sp} />
        <p>
          Every great barn starts with a name and a patch of dirt. Land runs <strong>{money(price.land_acre)}/acre</strong>{" "}
          and you need <strong>one acre per horse</strong>. You can always buy more later. You have{" "}
          <strong>{money(viewer.balance)}</strong>.
        </p>
        <div className="box">
          <div className="box-body">
            <form action={launchStable} className="stack">
              <div className="field">
                <label htmlFor="name">Stable name</label>
                <input id="name" name="name" required maxLength={80} placeholder="e.g. Willow Creek Farm" />
              </div>
              <div className="fields-3">
                <div className="field">
                  <label htmlFor="city">Town / city</label>
                  <input id="city" name="city" maxLength={80} />
                </div>
                <div className="field">
                  <label htmlFor="region">State / province / region</label>
                  <input id="region" name="region" maxLength={80} />
                </div>
                <div className="field">
                  <label htmlFor="country">Country</label>
                  <input id="country" name="country" maxLength={80} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="terrain">Terrain</label>
                <input id="terrain" name="terrain" maxLength={80} placeholder="Rolling bluegrass hills, desert scrub, coastal pasture…" />
              </div>
              <div className="field">
                <label htmlFor="acres">Starting acres</label>
                <input id="acres" name="acres" type="number" min={1} max={1000} defaultValue={5} required />
                <span className="hint">{money(price.land_acre)} each. Five acres is a cozy start.</span>
              </div>
              <SubmitButton>Launch stable</SubmitButton>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const refund = Math.floor((price.land_acre * price.land_sellback_pct) / 100);

  return (
    <>
      <div className="spread">
        <h1 className="mt0">{stable.name}</h1>
        <Link href={`/stables/${viewer.username}`} className="btn btn-ghost btn-small">
          View public page →
        </Link>
      </div>
      <Flash sp={sp} />

      <div className="grid-2">
        <div className="box">
          <div className="box-title">Land Office</div>
          <div className="box-body">
            <p className="mt0">
              <span className="big-number">{stable.acres}</span> acres ·{" "}
              <strong>
                {horseCount ?? 0} horse{horseCount === 1 ? "" : "s"}
              </strong>{" "}
              on the property · room for {Math.max(0, stable.acres - (horseCount ?? 0))} more
            </p>
            <form action={buyLand} className="row">
              <input name="acres" type="number" min={1} max={10000} defaultValue={1} style={{ width: 110 }} required />
              <SubmitButton>Buy acres ({money(price.land_acre)}/ea)</SubmitButton>
            </form>
            <details style={{ marginTop: 12 }}>
              <summary className="small">Sell land back ({money(refund)}/acre)</summary>
              <form action={sellLand} className="row">
                <input name="acres" type="number" min={1} defaultValue={1} style={{ width: 110 }} required />
                <SubmitButton className="btn btn-red" confirm="Sell this land back at a loss?">
                  Sell acres
                </SubmitButton>
              </form>
            </details>
          </div>
        </div>

        <div className="box">
          <div className="box-title">Stable details</div>
          <div className="box-body">
            <details>
              <summary>Edit name, location, banner &amp; description</summary>
              <form action={updateStable} className="stack">
                <div className="field">
                  <label>Name</label>
                  <input name="name" defaultValue={stable.name ?? ""} maxLength={80} required />
                </div>
                <div className="field">
                  <label>Tagline</label>
                  <input name="tagline" defaultValue={stable.tagline ?? ""} maxLength={160} placeholder="Home of champions and one very naughty pony" />
                </div>
                <div className="fields-3">
                  <div className="field">
                    <label>Town / city</label>
                    <input name="city" defaultValue={stable.location_city ?? ""} />
                  </div>
                  <div className="field">
                    <label>State / region</label>
                    <input name="region" defaultValue={stable.location_region ?? ""} />
                  </div>
                  <div className="field">
                    <label>Country</label>
                    <input name="country" defaultValue={stable.location_country ?? ""} />
                  </div>
                </div>
                <div className="fields-2">
                  <div className="field">
                    <label>Terrain</label>
                    <input name="terrain" defaultValue={stable.terrain ?? ""} />
                  </div>
                  <div className="field">
                    <label>Specialties</label>
                    <input name="specialties" defaultValue={stable.specialties ?? ""} placeholder="Reining, sport horse breeding…" />
                  </div>
                </div>
                <div className="field">
                  <label>About the stable</label>
                  <textarea name="description" defaultValue={stable.description ?? ""} rows={6} />
                </div>
                <div className="field">
                  <label>Banner image</label>
                  <input name="banner" type="file" accept="image/*" />
                </div>
                <SubmitButton>Save details</SubmitButton>
              </form>
            </details>
          </div>
        </div>
      </div>

      <h2>Facilities ({facilities?.length ?? 0})</h2>
      {facilities?.length ? (
        facilities.map((f: any) => {
          const t = typeMap[f.kind];
          return (
            <div className="box" key={f.id}>
              <div className="box-title">
                <span>
                  {f.name} <span className="muted small">· {t?.label}</span>
                </span>
                <span className="small muted">invested {money(f.cost_paid)}</span>
              </div>
              <div className="box-body">
                <p className="mt0 small">
                  {f.dimensions && <>📐 {f.dimensions} · </>}
                  {f.footing && <>Footing: <strong>{footingMap[f.footing]?.label}</strong> · </>}
                  {t?.has_stalls && <>Stalls: <strong>{f.stalls}</strong> · </>}
                  {f.features?.length ? <>Extras: {f.features.map((k: string) => featureMap[k]).join(", ")}</> : "No extras"}
                </p>
                {f.description && <p className="small prose">{f.description}</p>}
                <details>
                  <summary className="small">Upgrade</summary>
                  <form action={upgradeFacility} className="stack">
                    <input type="hidden" name="id" value={f.id} />
                    <div className="fields-2">
                      {t?.has_footing && (
                        <div className="field">
                          <label>New footing</label>
                          <select name="footing" defaultValue="">
                            <option value="">Keep current</option>
                            {footings?.map((ft: any) => (
                              <option key={ft.key} value={ft.key} disabled={ft.key === f.footing}>
                                {ft.label} ({money(ft.price)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {t?.has_stalls && (
                        <div className="field">
                          <label>Add stalls ({money(price.stall)}/ea)</label>
                          <input name="add_stalls" type="number" min={0} max={100} defaultValue={0} />
                        </div>
                      )}
                    </div>
                    <div className="field">
                      <span className="label">Add extras ({money(price.facility_feature)}/ea)</span>
                      <div className="checks">
                        {features
                          ?.filter((x: any) => !f.features?.includes(x.key))
                          .map((x: any) => (
                            <label key={x.key}>
                              <input type="checkbox" name="features" value={x.key} /> {x.label}
                            </label>
                          ))}
                      </div>
                    </div>
                    <SubmitButton className="btn btn-small">Buy upgrade</SubmitButton>
                  </form>
                </details>
                <details>
                  <summary className="small">Rename / describe / demolish</summary>
                  <form action={editFacility} className="stack">
                    <input type="hidden" name="id" value={f.id} />
                    <div className="fields-2">
                      <div className="field">
                        <label>Name</label>
                        <input name="name" defaultValue={f.name} required maxLength={80} />
                      </div>
                      <div className="field">
                        <label>Dimensions</label>
                        <input name="dimensions" defaultValue={f.dimensions ?? ""} maxLength={60} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Description</label>
                      <textarea name="description" defaultValue={f.description ?? ""} rows={3} />
                    </div>
                    <div className="row">
                      <SubmitButton className="btn btn-small">Save</SubmitButton>
                    </div>
                  </form>
                  <form action={demolishFacility} style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={f.id} />
                    <SubmitButton className="btn btn-small btn-red" confirm={`Demolish ${f.name}? No refund.`}>
                      Demolish
                    </SubmitButton>
                  </form>
                </details>
              </div>
            </div>
          );
        })
      ) : (
        <div className="empty">Nothing built yet. Even a round pen is a start.</div>
      )}

      <h2>Build something</h2>
      <div className="box">
        <div className="box-body">
          <form action={buildFacility} className="stack">
            <div className="fields-2">
              <div className="field">
                <label htmlFor="kind">Facility type</label>
                <select id="kind" name="kind" required>
                  {types?.map((t: any) => (
                    <option key={t.kind} value={t.kind}>
                      {t.label} — {money(t.base_price)}
                      {t.has_footing ? " + footing" : ""}
                      {t.has_stalls ? " + stalls" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="fname">Name it</label>
                <input id="fname" name="name" maxLength={80} placeholder="The Big Red Barn" />
              </div>
            </div>
            <div className="fields-3">
              <div className="field">
                <label htmlFor="footing">Footing (arenas, pens, tracks)</label>
                <select id="footing" name="footing" defaultValue="sand">
                  {footings?.map((ft: any) => (
                    <option key={ft.key} value={ft.key}>
                      {ft.label} (+{money(ft.price)})
                    </option>
                  ))}
                </select>
                <span className="hint">Ignored for facilities without footing.</span>
              </div>
              <div className="field">
                <label htmlFor="stalls">Stalls (barns)</label>
                <input id="stalls" name="stalls" type="number" min={0} max={200} defaultValue={0} />
                <span className="hint">{money(price.stall)} each. Ignored where there are no stalls.</span>
              </div>
              <div className="field">
                <label htmlFor="dimensions">Dimensions</label>
                <input id="dimensions" name="dimensions" maxLength={60} placeholder="100' x 200'" />
                <span className="hint">Leave blank for the standard size.</span>
              </div>
            </div>
            <div className="field">
              <span className="label">Extras ({money(price.facility_feature)} each)</span>
              <div className="checks">
                {features?.map((x: any) => (
                  <label key={x.key}>
                    <input type="checkbox" name="features" value={x.key} /> {x.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="fdesc">Description</label>
              <textarea id="fdesc" name="description" rows={3} placeholder="Describe it for your stable page." />
            </div>
            <SubmitButton>Build it</SubmitButton>
          </form>
          <details style={{ marginTop: 14 }}>
            <summary className="small">Price sheet</summary>
            <div className="grid-2">
              <table className="list small">
                <thead>
                  <tr>
                    <th>Facility</th>
                    <th className="num">Base</th>
                  </tr>
                </thead>
                <tbody>
                  {types?.map((t: any) => (
                    <tr key={t.kind}>
                      <td>
                        {t.label}
                        <div className="muted">{t.description}</div>
                      </td>
                      <td className="num">{money(t.base_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="list small">
                <thead>
                  <tr>
                    <th>Footing</th>
                    <th className="num">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {footings?.map((f: any) => (
                    <tr key={f.key}>
                      <td>
                        {f.label}
                        <div className="muted">{f.description}</div>
                      </td>
                      <td className="num">{money(f.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
