import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string | undefined;
  username: string;
  displayName: string;
  isAdmin: boolean;
  balance: number;
  ageCredits: number;
  stable: {
    id: string;
    name: string | null;
    launched: boolean;
    acres: number;
  } | null;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: bank }, { data: stable }] = await Promise.all([
    supabase.from("profiles").select("username, display_name, is_admin").eq("id", user.id).maybeSingle(),
    supabase.from("bank_accounts").select("balance, age_credits").eq("profile_id", user.id).maybeSingle(),
    supabase.from("stables").select("id, name, launched, acres").eq("owner_id", user.id).maybeSingle(),
  ]);
  if (!profile) return null;

  return {
    id: user.id,
    email: user.email,
    username: profile.username,
    displayName: profile.display_name ?? profile.username,
    isAdmin: profile.is_admin,
    balance: Number(bank?.balance ?? 0),
    ageCredits: bank?.age_credits ?? 0,
    stable: stable ?? null,
  };
});

export async function requireViewer(next = "/dashboard"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  return viewer;
}
