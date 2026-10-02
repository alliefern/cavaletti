"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { uploadImage } from "@/lib/upload";
import { finish, int, str } from "@/lib/actions";

// Shops ---------------------------------------------------------------------

export async function openShop(fd: FormData) {
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("open_shop", { p_name: str(fd, "name"), p_description: str(fd, "description") });
  if (error) finish("/shops", error);
  redirect(`/shops/${id}?ok=${encodeURIComponent("Shop's open! Add some stock.")}`);
}

export async function updateShop(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const { error } = await supabase
    .from("shops")
    .update({ name: str(fd, "name"), description: str(fd, "description") || null, is_open: str(fd, "is_open") === "on" })
    .eq("id", id);
  finish(`/shops/${id}`, error, "Shop updated.");
}

export async function addItem(fd: FormData) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const shop = str(fd, "shop_id");
  const img = await uploadImage(supabase, viewer.id, fd.get("image"), "shop");
  if (img.error) finish(`/shops/${shop}`, { message: img.error });
  const stock = int(fd, "stock");
  const { error } = await supabase.from("shop_items").insert({
    shop_id: shop,
    name: str(fd, "name"),
    description: str(fd, "description") || null,
    category: str(fd, "category") || null,
    price: int(fd, "price") ?? 0,
    stock: stock === null ? null : stock,
    image_url: img.url,
  });
  finish(`/shops/${shop}`, error, "Item stocked.");
}

export async function removeItem(fd: FormData) {
  const supabase = await createClient();
  const shop = str(fd, "shop_id");
  const { error } = await supabase.from("shop_items").update({ active: false }).eq("id", str(fd, "id"));
  finish(`/shops/${shop}`, error, "Item pulled from the shelf.");
}

export async function buyItem(fd: FormData) {
  const supabase = await createClient();
  const shop = str(fd, "shop_id");
  const { error } = await supabase.rpc("buy_item", { p_item: str(fd, "id"), p_qty: int(fd, "qty") ?? 1 });
  finish(`/shops/${shop}`, error, "Purchased! Check your inventory on My Barn.");
}

// Associations ----------------------------------------------------------------

export async function foundAssociation(fd: FormData) {
  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("found_association", {
    p_name: str(fd, "name"),
    p_abbr: str(fd, "abbreviation"),
    p_kind: str(fd, "kind"),
    p_description: str(fd, "description"),
    p_rules: str(fd, "rules"),
    p_fee: int(fd, "fee") ?? 0,
  });
  if (error) finish("/associations/new", error);
  redirect(`/associations/${slug}?ok=${encodeURIComponent("Chartered! You're president now. Use your power wisely.")}`);
}

export async function joinAssociation(fd: FormData) {
  const supabase = await createClient();
  const slug = str(fd, "slug");
  const { error } = await supabase.rpc("join_association", { p_association: str(fd, "id") });
  finish(`/associations/${slug}`, error, "Welcome to the club.");
}

export async function leaveAssociation(fd: FormData) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const slug = str(fd, "slug");
  const { error } = await supabase
    .from("association_members")
    .delete()
    .eq("association_id", str(fd, "id"))
    .eq("profile_id", viewer.id);
  finish(`/associations/${slug}`, error, "You've left the association.");
}

export async function updateAssociation(fd: FormData) {
  const supabase = await createClient();
  const slug = str(fd, "slug");
  const { error } = await supabase
    .from("associations")
    .update({ description: str(fd, "description") || null, rules: str(fd, "rules") || null, membership_fee: int(fd, "fee") ?? 0 })
    .eq("id", str(fd, "id"));
  finish(`/associations/${slug}`, error, "Association updated.");
}

// Forum ----------------------------------------------------------------------

export async function createThread(fd: FormData) {
  const supabase = await createClient();
  const kind = str(fd, "kind") || "discussion";
  const classes = str(fd, "classes")
    .split(/\n|,/)
    .map((c) => c.trim())
    .filter(Boolean);
  const { data: id, error } = await supabase.rpc("create_thread", {
    p_category: int(fd, "category_id"),
    p_title: str(fd, "title"),
    p_body: str(fd, "body"),
    p_kind: kind,
    p_horse: str(fd, "horse_id") || null,
    p_show_date: str(fd, "show_date") || null,
    p_show_classes: classes,
    p_entry_fee: int(fd, "entry_fee") ?? 0,
  });
  if (error) finish(`/forum/new?category=${str(fd, "category_slug")}&kind=${kind}`, error);
  redirect(`/forum/t/${id}`);
}

export async function reply(fd: FormData) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const thread = str(fd, "thread_id");
  const { error } = await supabase.from("forum_posts").insert({ thread_id: Number(thread), author_id: viewer.id, body: str(fd, "body") });
  finish(`/forum/t/${thread}#latest`, error);
}

export async function editPost(fd: FormData) {
  const supabase = await createClient();
  const thread = str(fd, "thread_id");
  const { error } = await supabase
    .from("forum_posts")
    .update({ body: str(fd, "body"), edited_at: new Date().toISOString() })
    .eq("id", int(fd, "id"));
  finish(`/forum/t/${thread}`, error, "Post edited.");
}

export async function enterShow(fd: FormData) {
  const supabase = await createClient();
  const thread = str(fd, "thread_id");
  const { error } = await supabase.rpc("enter_show", { p_thread: Number(thread), p_horse: str(fd, "horse_id"), p_class: str(fd, "class_name") });
  finish(`/forum/t/${thread}`, error, "Entered! Go braid that mane.");
}

export async function setShowStatus(fd: FormData) {
  const supabase = await createClient();
  const thread = str(fd, "thread_id");
  const { error } = await supabase.rpc("set_show_status", { p_thread: Number(thread), p_status: str(fd, "status") });
  finish(`/forum/t/${thread}`, error, "Show updated.");
}

export async function savePlacings(fd: FormData) {
  const supabase = await createClient();
  const thread = str(fd, "thread_id");
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith("place_")) continue;
    const entry = Number(key.slice(6));
    const placing = String(value).trim() === "" ? null : Number(value);
    const { error } = await supabase.rpc("set_placing", { p_entry: entry, p_placing: placing });
    if (error) finish(`/forum/t/${thread}`, error);
  }
  finish(`/forum/t/${thread}`, null, "Placings saved.");
}

export async function moderate(fd: FormData) {
  const supabase = await createClient();
  const thread = str(fd, "thread_id");
  const { error } = await supabase.rpc("moderate_thread", {
    p_thread: Number(thread),
    p_pinned: str(fd, "pinned") === "" ? null : str(fd, "pinned") === "true",
    p_locked: str(fd, "locked") === "" ? null : str(fd, "locked") === "true",
  });
  finish(`/forum/t/${thread}`, error, "Thread updated.");
}
