"use server";

import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { uploadImage } from "@/lib/upload";
import { finish, int, str } from "@/lib/actions";

export async function launchStable(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("launch_stable", {
    p_name: str(fd, "name"),
    p_city: str(fd, "city"),
    p_region: str(fd, "region"),
    p_country: str(fd, "country"),
    p_terrain: str(fd, "terrain"),
    p_acres: int(fd, "acres") ?? 0,
  });
  finish("/stable", error, "Your stable is officially open. Go get some horses.");
}

export async function updateStable(fd: FormData) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const banner = await uploadImage(supabase, viewer.id, fd.get("banner"), "stable");
  if (banner.error) finish("/stable", { message: banner.error });
  const patch: Record<string, string | null> = {
    name: str(fd, "name") || null,
    tagline: str(fd, "tagline") || null,
    description: str(fd, "description") || null,
    location_city: str(fd, "city") || null,
    location_region: str(fd, "region") || null,
    location_country: str(fd, "country") || null,
    terrain: str(fd, "terrain") || null,
    specialties: str(fd, "specialties") || null,
  };
  if (banner.url) patch.banner_url = banner.url;
  const { error } = await supabase.from("stables").update(patch).eq("owner_id", viewer.id);
  finish("/stable", error, "Stable details saved.");
}

export async function buyLand(fd: FormData) {
  const supabase = await createClient();
  const acres = int(fd, "acres");
  const { error } = await supabase.rpc("buy_land", { p_acres: acres });
  finish("/stable", error, `Bought ${acres} acre(s). More room to roam.`);
}

export async function sellLand(fd: FormData) {
  const supabase = await createClient();
  const acres = int(fd, "acres");
  const { error } = await supabase.rpc("sell_land", { p_acres: acres });
  finish("/stable", error, `Sold ${acres} acre(s) back to the land office.`);
}

export async function buildFacility(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("build_facility", {
    p_kind: str(fd, "kind"),
    p_name: str(fd, "name"),
    p_footing: str(fd, "footing") || null,
    p_dimensions: str(fd, "dimensions"),
    p_stalls: int(fd, "stalls") ?? 0,
    p_features: fd.getAll("features").map(String),
    p_description: str(fd, "description"),
  });
  finish("/stable", error, "Construction complete. The contractor was even on time.");
}

export async function upgradeFacility(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("upgrade_facility", {
    p_facility: str(fd, "id"),
    p_footing: str(fd, "footing") || null,
    p_add_stalls: int(fd, "add_stalls") ?? 0,
    p_add_features: fd.getAll("features").map(String),
  });
  finish("/stable", error, "Upgrade done.");
}

export async function editFacility(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("facilities")
    .update({ name: str(fd, "name"), dimensions: str(fd, "dimensions") || null, description: str(fd, "description") || null })
    .eq("id", str(fd, "id"));
  finish("/stable", error, "Facility updated.");
}

export async function demolishFacility(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities").delete().eq("id", str(fd, "id"));
  finish("/stable", error, "Demolished. No refunds, that's how bulldozers work.");
}

export async function updateProfile(fd: FormData) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const avatar = await uploadImage(supabase, viewer.id, fd.get("avatar"), "avatar");
  if (avatar.error) finish("/settings", { message: avatar.error });
  const patch: Record<string, string | null> = {
    display_name: str(fd, "display_name") || null,
    bio: str(fd, "bio") || null,
  };
  if (avatar.url) patch.avatar_url = avatar.url;
  const { error } = await supabase.from("profiles").update(patch).eq("id", viewer.id);
  finish("/settings", error, "Profile saved.");
}
