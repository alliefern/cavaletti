import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { updateProfile } from "@/app/actions/stable";
import { Flash, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Profile settings" };

export default async function Settings({ searchParams }: { searchParams: SP }) {
  const viewer = await requireViewer("/settings");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", viewer.id).single();

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Profile</h1>
      <Flash sp={sp} />
      <div className="box">
        <div className="box-body">
          <form action={updateProfile} className="stack">
            <div className="field">
              <span className="label">Username</span>
              <span>
                <strong>{profile.username}</strong> <span className="muted small">(usernames are permanent)</span>
              </span>
            </div>
            <div className="field">
              <label htmlFor="display_name">Display name</label>
              <input id="display_name" name="display_name" defaultValue={profile.display_name ?? ""} maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="bio">About you</label>
              <textarea id="bio" name="bio" defaultValue={profile.bio ?? ""} maxLength={4000} />
              <span className="hint">Shows on your stable page and next to your forum posts.</span>
            </div>
            <div className="field">
              <label htmlFor="avatar">Avatar</label>
              {profile.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" style={{ width: 80, height: 80, objectFit: "cover" }} />
              )}
              <input id="avatar" name="avatar" type="file" accept="image/*" />
            </div>
            <SubmitButton>Save profile</SubmitButton>
          </form>
        </div>
      </div>
      <p>
        <Link href="/auth/update-password">Change password</Link>
      </p>
    </div>
  );
}
