import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { createHorse } from "@/app/actions/horses";
import { Flash, type SP } from "@/components/Flash";
import { HorseFields } from "@/components/HorseFields";
import { SubmitButton } from "@/components/SubmitButton";
import { money, today } from "@/lib/format";

export const metadata = { title: "New foundation horse" };

export default async function NewHorse({ searchParams }: { searchParams: SP }) {
  const viewer = await requireViewer("/horses/new");
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: breeds }, { data: price }] = await Promise.all([
    supabase.from("breeds").select("id, name").order("name"),
    supabase.from("price_list").select("amount").eq("key", "horse_creation").single(),
  ]);

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Import a foundation horse</h1>
      <Flash sp={sp} />
      <p>
        Foundation horses are brand-new to Cavaletti. Their parents can be names on paper (no records needed). Import fee
        is <strong>{money(price?.amount)}</strong>, and every horse needs an acre. Stats are rolled at random when they
        arrive. You can’t pick them, sorry.
      </p>
      {!viewer.stable?.launched && (
        <div className="flash flash-error">
          You need to <Link href="/stable">launch your stable</Link> first.
        </div>
      )}
      <div className="box">
        <div className="box-body">
          <form action={createHorse} className="stack">
            <div className="fields-2">
              <div className="field">
                <label htmlFor="registered_name">Registered name</label>
                <input id="registered_name" name="registered_name" required minLength={2} maxLength={60} />
              </div>
              <div className="field">
                <label htmlFor="barn_name">Barn name</label>
                <input id="barn_name" name="barn_name" maxLength={40} />
              </div>
            </div>
            <div className="fields-3">
              <div className="field">
                <label htmlFor="breed_id">Breed</label>
                <select id="breed_id" name="breed_id" required>
                  {breeds?.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sex">Sex</label>
                <select id="sex" name="sex" required>
                  <option value="mare">Mare</option>
                  <option value="stallion">Stallion</option>
                  <option value="gelding">Gelding</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="birth_date">Foaling date</label>
                <input id="birth_date" name="birth_date" type="date" max={today()} required />
                <span className="hint">Age is real-time from this date.</span>
              </div>
            </div>
            <div className="fields-2">
              <div className="field">
                <label htmlFor="sire_name">Sire (on paper)</label>
                <input id="sire_name" name="sire_name" maxLength={60} placeholder="Optional" />
              </div>
              <div className="field">
                <label htmlFor="dam_name">Dam (on paper)</label>
                <input id="dam_name" name="dam_name" maxLength={60} placeholder="Optional" />
              </div>
            </div>
            <HorseFields />
            <SubmitButton>Import horse ({money(price?.amount)})</SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
