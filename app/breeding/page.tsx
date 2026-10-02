import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { registerFoal } from "@/app/actions/horses";
import { Flash, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { ageLabel, breedingStatus, money, today } from "@/lib/format";

export const metadata = { title: "Breeding barn" };

export default async function Breeding({ searchParams }: { searchParams: SP }) {
  const viewer = await requireViewer("/breeding");
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: mares }, { data: myStallions }, { data: studs }, { data: breeds }, { data: fee }] = await Promise.all([
    supabase
      .from("horses")
      .select("id, registered_name, birth_date, age_bonus_years, sex, status, breeds(name)")
      .eq("owner_id", viewer.id)
      .eq("sex", "mare")
      .neq("status", "deceased")
      .order("registered_name"),
    supabase
      .from("horses")
      .select("id, registered_name, birth_date, age_bonus_years, sex, status, breeds(name)")
      .eq("owner_id", viewer.id)
      .eq("sex", "stallion")
      .order("registered_name"),
    supabase
      .from("horses")
      .select("id, registered_name, birth_date, age_bonus_years, sex, status, stud_fee, breeds(name), profiles!horses_owner_id_fkey(username)")
      .eq("at_stud", true)
      .neq("owner_id", viewer.id)
      .order("registered_name"),
    supabase.from("breeds").select("id, name").order("name"),
    supabase.from("price_list").select("amount").eq("key", "foal_registration").single(),
  ]);

  return (
    <>
      <h1>Breeding Barn</h1>
      <Flash sp={sp} />
      <div className="sidebar-layout">
        <div>
          <p className="mt0">
            Pick a mare you own and a stallion (yours, or anyone’s standing at stud). Registration is{" "}
            <strong>{money(fee?.amount)}</strong> plus any stud fee, paid straight to the stallion’s owner.
          </p>
          <div className="box">
            <div className="box-title">Register a foal</div>
            <div className="box-body">
              {!mares?.length ? (
                <div className="empty">
                  You don’t own any mares yet. <Link href="/horses/new">Import one</Link> or <Link href="/market">buy one</Link>.
                </div>
              ) : (
                <form action={registerFoal} className="stack">
                  <div className="fields-2">
                    <div className="field">
                      <label htmlFor="dam">Dam (your mare)</label>
                      <select id="dam" name="dam" required defaultValue={sp.dam ?? ""}>
                        <option value="" disabled>
                          Choose a mare…
                        </option>
                        {mares.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.registered_name} ({m.breeds?.name}, {ageLabel(m.birth_date, m.age_bonus_years)})
                            {!breedingStatus(m).ok ? ` — ${breedingStatus(m).label} today` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="sire">Sire</label>
                      <select id="sire" name="sire" required defaultValue={sp.sire ?? ""}>
                        <option value="" disabled>
                          Choose a stallion…
                        </option>
                        {myStallions?.length ? (
                          <optgroup label="Your stallions">
                            {myStallions.map((s: any) => (
                              <option key={s.id} value={s.id}>
                                {s.registered_name} ({s.breeds?.name}, {ageLabel(s.birth_date, s.age_bonus_years)})
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        {studs?.length ? (
                          <optgroup label="Standing at stud">
                            {studs.map((s: any) => (
                              <option key={s.id} value={s.id}>
                                {s.registered_name} ({s.breeds?.name}) — {money(s.stud_fee)} · {s.profiles?.username}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </div>
                  </div>

                  <div className="fields-2">
                    <div className="field">
                      <label htmlFor="birth_date">Foaling date</label>
                      <input id="birth_date" name="birth_date" type="date" defaultValue={today()} max={today()} required />
                      <span className="hint">
                        Today for a live foal, or a <strong>past date for retroactive breeding</strong>. Both parents had to be
                        3+ and not past retirement on that date.
                      </span>
                    </div>
                    <div className="field">
                      <span className="label">Where is this foal now?</span>
                      <label className="small">
                        <input type="radio" name="keep" value="keep" defaultChecked /> On my farm (needs an acre)
                      </label>
                      <label className="small">
                        <input type="radio" name="keep" value="record" /> Record only: sold/elsewhere, just goes in the books
                      </label>
                    </div>
                  </div>

                  <div className="fields-2">
                    <div className="field">
                      <label htmlFor="registered_name">Foal’s registered name</label>
                      <input id="registered_name" name="registered_name" required minLength={2} maxLength={60} />
                    </div>
                    <div className="field">
                      <label htmlFor="barn_name">Barn name</label>
                      <input id="barn_name" name="barn_name" maxLength={40} />
                    </div>
                  </div>
                  <div className="fields-3">
                    <div className="field">
                      <label htmlFor="sex">Sex</label>
                      <select id="sex" name="sex" defaultValue="random">
                        <option value="random">Let nature decide</option>
                        <option value="mare">Filly</option>
                        <option value="stallion">Colt</option>
                        <option value="gelding">Gelding</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="breed_id">Register as</label>
                      <select id="breed_id" name="breed_id" required>
                        {breeds?.map((b: any) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <span className="hint">Sire’s breed, dam’s breed, or Grade / Crossbred.</span>
                    </div>
                    <div className="field">
                      <label htmlFor="color">Color</label>
                      <input id="color" name="color" maxLength={60} />
                    </div>
                  </div>
                  <div className="fields-2">
                    <div className="field">
                      <label htmlFor="markings">Markings</label>
                      <input id="markings" name="markings" maxLength={200} />
                    </div>
                    <div className="field">
                      <label htmlFor="image">Photo / art (optional)</label>
                      <input id="image" name="image" type="file" accept="image/*" />
                    </div>
                  </div>
                  <SubmitButton className="btn btn-brown">Register foal</SubmitButton>
                </form>
              )}
            </div>
          </div>
        </div>

        <aside>
          <div className="box">
            <div className="box-title">The Rules</div>
            <div className="box-body small">
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                <li>Both parents: age 3+</li>
                <li>Mares breed through age 24, stallions through 30</li>
                <li>Geldings can’t breed</li>
                <li>One foal per mare per 11 months</li>
                <li>Foal stats = parents’ average + a little luck</li>
                <li>Got a 10-year-old mare? Back-fill the foals she had from age 3 on. Retro foals show up in pedigrees.</li>
                <li>Foals can be aged up +3 years once (credit or cash) so they can show.</li>
              </ul>
            </div>
          </div>
          <div className="box">
            <div className="box-title">
              At stud now <Link href="/market?tab=stud">all →</Link>
            </div>
            <div className="box-body small">
              {studs?.length ? (
                studs.slice(0, 10).map((s: any) => (
                  <div key={s.id} style={{ marginBottom: 6 }}>
                    <Link href={`/horses/${s.id}`}>{s.registered_name}</Link> · {money(s.stud_fee)}
                    <div className="muted">
                      {s.breeds?.name} · {s.profiles?.username}
                    </div>
                  </div>
                ))
              ) : (
                <span className="muted">No outside stallions standing yet.</span>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
