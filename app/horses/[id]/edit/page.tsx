import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { updateHorse } from "@/app/actions/horses";
import { Flash, type SP } from "@/components/Flash";
import { HorseFields } from "@/components/HorseFields";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Edit horse" };

export default async function EditHorse({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const viewer = await requireViewer(`/horses/${id}/edit`);
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: h } = await supabase.from("horses").select("*").eq("id", id).maybeSingle();
  if (!h) notFound();
  if (h.owner_id !== viewer.id) redirect(`/horses/${id}`);

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Edit {h.registered_name}</h1>
      <Flash sp={sp} />
      <div className="box">
        <div className="box-body">
          <form action={updateHorse} className="stack">
            <input type="hidden" name="id" value={h.id} />
            <div className="fields-2">
              <div className="field">
                <label htmlFor="registered_name">Registered name</label>
                <input id="registered_name" name="registered_name" defaultValue={h.registered_name} required minLength={2} maxLength={60} />
              </div>
              <div className="field">
                <label htmlFor="barn_name">Barn name</label>
                <input id="barn_name" name="barn_name" defaultValue={h.barn_name ?? ""} maxLength={40} />
              </div>
            </div>
            <HorseFields h={h} />
            {h.image_url && (
              <label className="small">
                <input type="checkbox" name="remove_image" /> Remove current photo
              </label>
            )}
            <SubmitButton>Save</SubmitButton>
          </form>
        </div>
      </div>
      <p className="small muted">
        Breed, sex, foaling date, parents, and stats are locked. That’s what makes a pedigree worth trusting.
      </p>
    </div>
  );
}
