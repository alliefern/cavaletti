"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { finish, str } from "@/lib/actions";

async function origin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${proto}://${host}`;
}

function safeNext(n: string) {
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function login(fd: FormData) {
  const supabase = await createClient();
  const next = safeNext(str(fd, "next"));
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, "email"), password: String(fd.get("password") ?? "") });
  if (error) finish(`/login?next=${encodeURIComponent(next)}`, error);
  redirect(next);
}

export async function signup(fd: FormData) {
  const supabase = await createClient();
  const username = str(fd, "username");
  const password = String(fd.get("password") ?? "");
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
    finish("/signup", { message: "Usernames are 3–24 letters, numbers, or underscores." });
  }
  if (password.length < 8) finish("/signup", { message: "Passwords need at least 8 characters." });
  if (password !== String(fd.get("confirm") ?? "")) finish("/signup", { message: "Those passwords don't match." });

  const { data: available } = await supabase.rpc("username_available", { p_username: username });
  if (available === false) finish("/signup", { message: `"${username}" is taken. Get creative.` });

  const { data, error } = await supabase.auth.signUp({
    email: str(fd, "email"),
    password,
    options: {
      data: { username, display_name: username },
      emailRedirectTo: `${await origin()}/auth/callback?next=/dashboard`,
    },
  });
  if (error) finish("/signup", error);
  if (data.session) redirect("/dashboard?ok=" + encodeURIComponent("Welcome to Cavaletti! $50,000 just hit your account."));
  redirect("/login?ok=" + encodeURIComponent("Check your email to confirm your account, then log in."));
}

export async function forgotPassword(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(str(fd, "email"), {
    redirectTo: `${await origin()}/auth/callback?next=/auth/update-password`,
  });
  // Same message either way, so this can't be used to check who has an account.
  if (error && !/not found/i.test(error.message)) finish("/forgot-password", error);
  finish("/forgot-password", null, "If that email has an account, a reset link is on its way.");
}

export async function updatePassword(fd: FormData) {
  const supabase = await createClient();
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) finish("/auth/update-password", { message: "Passwords need at least 8 characters." });
  if (password !== String(fd.get("confirm") ?? "")) finish("/auth/update-password", { message: "Those passwords don't match." });
  const { error } = await supabase.auth.updateUser({ password });
  if (error) finish("/auth/update-password", error);
  finish("/dashboard", null, "Password updated.");
}
