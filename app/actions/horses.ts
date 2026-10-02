"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { uploadImage } from "@/lib/upload";
import { bool, finish, int, num, str } from "@/lib/actions";

export async function createHorse(fd: FormData) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_horse", {
    p_registered_name: str(fd, "registered_name"),
    p_barn_name: str(fd, "barn_name"),
    p_breed_id: int(fd, "breed_id"),
    p_sex: str(fd, "sex"),
    p_color: str(fd, "color"),
    p_markings: str(fd, "markings"),
    p_height: num(fd, "height"),
    p_birth_date: str(fd, "birth_date") || null,
    p_sire_name: str(fd, "sire_name"),
    p_dam_name: str(fd, "dam_name"),
    p_discipline: str(fd, "discipline"),
    p_personality: str(fd, "personality"),
    p_blurb: str(fd, "blurb"),
    p_about: str(fd, "about"),
  });
  if (error) finish("/horses/new", error);
  const img = await uploadImage(supabase, viewer.id, fd.get("image"), "horses");
  if (img.url) await supabase.from("horses").update({ image_url: img.url }).eq("id", id);
  redirect(`/horses/${id}?ok=${encodeURIComponent("Welcome to the herd! Stats were rolled at random. No take-backsies.")}`);
}

export async function updateHorse(fd: FormData) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const id = str(fd, "id");
  const img = await uploadImage(supabase, viewer.id, fd.get("image"), "horses");
  if (img.error) finish(`/horses/${id}/edit`, { message: img.error });
  const patch: Record<string, unknown> = {
    registered_name: str(fd, "registered_name"),
    barn_name: str(fd, "barn_name") || null,
    color: str(fd, "color") || null,
    markings: str(fd, "markings") || null,
    height_hands: num(fd, "height"),
    discipline: str(fd, "discipline") || null,
    personality: str(fd, "personality") || null,
    blurb: str(fd, "blurb") || null,
    about: str(fd, "about") || null,
  };
  if (img.url) patch.image_url = img.url;
  if (bool(fd, "remove_image")) patch.image_url = null;
  const { error } = await supabase.from("horses").update(patch).eq("id", id);
  if (error) finish(`/horses/${id}/edit`, error);
  finish(`/horses/${id}`, null, "Saved.");
}

export async function setSale(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const on = bool(fd, "for_sale");
  const price = int(fd, "sale_price");
  if (on && (price === null || price < 0)) finish(`/horses/${id}`, { message: "Set an asking price." });
  const { error } = await supabase
    .from("horses")
    .update({ for_sale: on, sale_price: on ? price : null })
    .eq("id", id);
  finish(`/horses/${id}`, error, on ? "Listed on the market." : "Taken off the market.");
}

export async function setStud(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const on = bool(fd, "at_stud");
  const fee = int(fd, "stud_fee");
  if (on && (fee === null || fee < 0)) finish(`/horses/${id}`, { message: "Set a stud fee (can be $0)." });
  const { error } = await supabase.from("horses").update({ at_stud: on, stud_fee: on ? fee : null }).eq("id", id);
  finish(`/horses/${id}`, error, on ? "Standing at stud. Ladies, form an orderly line." : "Pulled from stud.");
}

export async function buyHorse(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const { error } = await supabase.rpc("buy_horse", { p_horse: id });
  finish(`/horses/${id}`, error, "Sold! The horse is yours. Paperwork filed, money moved.");
}

export async function offerHorse(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const { error } = await supabase.rpc("offer_horse", {
    p_horse: id,
    p_to_username: str(fd, "to"),
    p_price: int(fd, "price") ?? 0,
    p_note: str(fd, "note"),
  });
  finish(`/horses/${id}`, error, `Transfer offer sent to ${str(fd, "to")}. It'll go through when they accept.`);
}

export async function respondOffer(fd: FormData) {
  const supabase = await createClient();
  const accept = str(fd, "answer") === "accept";
  const { error } = await supabase.rpc("respond_offer", { p_offer: int(fd, "offer"), p_accept: accept });
  finish(str(fd, "back") || "/dashboard", error, accept ? "Transfer complete. New horse, who dis?" : "Offer closed.");
}

export async function ageUp(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const { error } = await supabase.rpc("age_up_foal", { p_horse: id, p_use_credit: str(fd, "pay") === "credit" });
  finish(`/horses/${id}`, error, "Aged up 3 years. Show-ring ready (ish).");
}

export async function setStatus(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const { error } = await supabase.rpc("set_horse_status", { p_horse: id, p_status: str(fd, "status") });
  finish(`/horses/${id}`, error, "Status updated.");
}

export async function geld(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const { error } = await supabase.rpc("geld_horse", { p_horse: id });
  finish(`/horses/${id}`, error, "Snip snip. He's a gelding now.");
}

export async function registerFoal(fd: FormData) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("register_foal", {
    p_dam: str(fd, "dam"),
    p_sire: str(fd, "sire"),
    p_birth_date: str(fd, "birth_date") || null,
    p_registered_name: str(fd, "registered_name"),
    p_barn_name: str(fd, "barn_name"),
    p_sex: str(fd, "sex") || "random",
    p_breed_id: int(fd, "breed_id"),
    p_color: str(fd, "color"),
    p_markings: str(fd, "markings"),
    p_keep: str(fd, "keep") !== "record",
  });
  if (error) {
    const back = new URLSearchParams({ dam: str(fd, "dam"), sire: str(fd, "sire") });
    finish(`/breeding?${back}`, error);
  }
  const img = await uploadImage(supabase, viewer.id, fd.get("image"), "horses");
  if (img.url) await supabase.from("horses").update({ image_url: img.url }).eq("id", id);
  redirect(`/horses/${id}?ok=${encodeURIComponent("It's a foal! Registered and on the record.")}`);
}
