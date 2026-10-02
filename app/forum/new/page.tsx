import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { createThread } from "@/app/actions/social";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { today } from "@/lib/format";

export const metadata = { title: "New thread" };

export default async function NewThread({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireViewer("/forum/new");
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: cats }, { data: horses }] = await Promise.all([
    supabase.from("forum_categories").select("id, slug, name, admin_only, default_kind").order("sort"),
    supabase.from("horses").select("id, registered_name, sex").eq("owner_id", viewer.id).neq("status", "deceased").order("registered_name"),
  ]);
  const selected = cats?.find((c: any) => c.slug === sp.category);
  const kind = sp.kind ?? selected?.default_kind ?? "discussion";

  return (
    <div style={{ maxWidth: 820 }}>
      <h1>Start a thread</h1>
      <Flash sp={sp} />
      <div className="box">
        <div className="box-body">
          <form action={createThread} className="stack">
            <input type="hidden" name="category_slug" value={sp.category ?? ""} />
            <div className="fields-2">
              <div className="field">
                <label htmlFor="category_id">Forum</label>
                <select id="category_id" name="category_id" defaultValue={selected?.id ?? ""} required>
                  <option value="" disabled>
                    Pick one…
                  </option>
                  {cats
                    ?.filter((c: any) => !c.admin_only || viewer.isAdmin)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="kind">Thread type</label>
                <select id="kind" name="kind" defaultValue={kind}>
                  <option value="discussion">Discussion</option>
                  <option value="sale">Sale ad (links a horse with a Buy button)</option>
                  <option value="stud">Stud ad (links a stallion)</option>
                  <option value="show">Show (takes entries)</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" required minLength={3} maxLength={140} />
            </div>
            <div className="field">
              <label htmlFor="horse_id">Feature a horse (sale &amp; stud ads)</label>
              <select id="horse_id" name="horse_id" defaultValue={sp.horse ?? ""}>
                <option value="">None</option>
                {horses?.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {h.registered_name} ({h.sex})
                  </option>
                ))}
              </select>
              <span className="hint">For a sale ad, list the horse for sale on its page first so the Buy button shows up.</span>
            </div>
            <fieldset>
              <legend>Show details (Show threads only)</legend>
              <div className="fields-2">
                <div className="field">
                  <label htmlFor="show_date">Show date</label>
                  <input id="show_date" name="show_date" type="date" min={today()} />
                </div>
                <div className="field">
                  <label htmlFor="entry_fee">Entry fee per class</label>
                  <input id="entry_fee" name="entry_fee" type="number" min={0} defaultValue={0} />
                  <span className="hint">Paid to you, the host.</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="classes">Classes (one per line)</label>
                <textarea id="classes" name="classes" rows={5} placeholder={"Halter — Mares\nHunter Under Saddle\nBarrel Racing\nGrand Prix Jumper"} />
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="body">Post</label>
              <textarea id="body" name="body" required rows={10} maxLength={20000} />
              <span className="hint">BBCode works: [b] [i] [u] [s] [quote] [url] [img] [center] [color=red] [size=large]</span>
            </div>
            <SubmitButton>Post thread</SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
