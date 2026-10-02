import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HorseImage } from "@/components/HorseImage";
import { ageLabel, money, sexLabel } from "@/lib/format";

export const metadata = { title: "Market" };

export default async function Market({ searchParams }: { searchParams: Promise<{ tab?: string; breed?: string; sex?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "stud" ? "stud" : "sale";
  const supabase = await createClient();

  let q = supabase
    .from("horses")
    .select("id, registered_name, sex, birth_date, age_bonus_years, image_url, sale_price, stud_fee, color, breed_id, breeds(name), profiles!horses_owner_id_fkey(username)")
    .eq(tab === "stud" ? "at_stud" : "for_sale", true)
    .order(tab === "stud" ? "stud_fee" : "sale_price", { ascending: true })
    .limit(120);
  if (sp.breed) q = q.eq("breed_id", Number(sp.breed));
  if (sp.sex && tab === "sale") q = q.eq("sex", sp.sex);
  const [{ data: horses }, { data: breeds }] = await Promise.all([q, supabase.from("breeds").select("id, name").order("name")]);

  return (
    <>
      <h1>The Market</h1>
      <div className="tabs">
        <Link href="/market" className={tab === "sale" ? "active" : ""}>
          Horses for sale
        </Link>
        <Link href="/market?tab=stud" className={tab === "stud" ? "active" : ""}>
          Stallions at stud
        </Link>
      </div>
      <form className="row" style={{ marginBottom: 14 }}>
        <input type="hidden" name="tab" value={tab} />
        <select name="breed" defaultValue={sp.breed ?? ""} style={{ maxWidth: 240 }}>
          <option value="">All breeds</option>
          {breeds?.map((b: any) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {tab === "sale" && (
          <select name="sex" defaultValue={sp.sex ?? ""} style={{ maxWidth: 160 }}>
            <option value="">Any sex</option>
            <option value="mare">Mares</option>
            <option value="stallion">Stallions</option>
            <option value="gelding">Geldings</option>
          </select>
        )}
        <button className="btn btn-small">Filter</button>
      </form>
      <p className="small muted">
        Sales are instant: hit Buy on the horse’s page and money + papers move together. Want to haggle? Take it to{" "}
        <Link href="/forum/horse-sales">Horse Sales</Link> and send a private transfer offer.
      </p>
      {horses?.length ? (
        <div className="horse-grid">
          {horses.map((h: any) => (
            <Link key={h.id} href={`/horses/${h.id}`} className="horse-card">
              <HorseImage src={h.image_url} alt={h.registered_name} />
              <div className="hc-body">
                <div className="hc-name">{h.registered_name}</div>
                <div className="small muted">
                  {h.breeds?.name} · {sexLabel(h.sex)} · {ageLabel(h.birth_date, h.age_bonus_years)}
                </div>
                <div className="small muted">{h.profiles?.username}</div>
                <div>
                  <strong>{money(tab === "stud" ? h.stud_fee : h.sale_price)}</strong>
                  {tab === "stud" && <span className="small muted"> stud fee</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">Nothing here right now.</div>
      )}
    </>
  );
}
