import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { foundAssociation } from "@/app/actions/social";
import { Flash, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { money } from "@/lib/format";

export const metadata = { title: "Charter an association" };

export default async function NewAssociation({ searchParams }: { searchParams: SP }) {
  await requireViewer("/associations/new");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: price } = await supabase.from("price_list").select("amount").eq("key", "association_charter").single();

  return (
    <div style={{ maxWidth: 700 }}>
      <h1>Charter an association</h1>
      <Flash sp={sp} />
      <p>
        Start a breed club, a show circuit, a riding club, a secret society of people who love chestnut mares. Charter
        fee is <strong>{money(price?.amount)}</strong>. You’ll be president. Dues go to you.
      </p>
      <div className="box">
        <div className="box-body">
          <form action={foundAssociation} className="stack">
            <div className="fields-2">
              <div className="field">
                <label>Name</label>
                <input name="name" required minLength={3} maxLength={100} />
              </div>
              <div className="field">
                <label>Abbreviation</label>
                <input name="abbreviation" maxLength={12} placeholder="e.g. CRC" />
              </div>
            </div>
            <div className="fields-2">
              <div className="field">
                <label>Type</label>
                <select name="kind" defaultValue="club">
                  <option value="club">Club</option>
                  <option value="discipline">Discipline / show circuit</option>
                  <option value="breed">Breed association</option>
                </select>
              </div>
              <div className="field">
                <label>Membership dues</label>
                <input name="fee" type="number" min={0} defaultValue={0} />
              </div>
            </div>
            <div className="field">
              <label>Description</label>
              <textarea name="description" rows={5} />
            </div>
            <div className="field">
              <label>Rules / bylaws</label>
              <textarea name="rules" rows={5} />
            </div>
            <SubmitButton>Charter it ({money(price?.amount)})</SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
