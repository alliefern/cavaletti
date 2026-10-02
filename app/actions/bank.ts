"use server";

import { createClient } from "@/lib/supabase/server";
import { finish, int, str } from "@/lib/actions";
import { money } from "@/lib/format";

export async function sendMoney(fd: FormData) {
  const supabase = await createClient();
  const amount = int(fd, "amount");
  const to = str(fd, "to");
  const { error } = await supabase.rpc("send_money", { p_to_username: to, p_amount: amount, p_memo: str(fd, "memo") });
  finish("/bank", error, `Sent ${money(amount)} to ${to}.`);
}

export async function writeCheck(fd: FormData) {
  const supabase = await createClient();
  const amount = int(fd, "amount");
  const to = str(fd, "to");
  const { error } = await supabase.rpc("write_check", { p_to_username: to, p_amount: amount, p_memo: str(fd, "memo") });
  finish("/bank", error, `Check for ${money(amount)} written to ${to}. It's held until they deposit it.`);
}

export async function depositCheck(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deposit_check", { p_check_id: int(fd, "id") });
  finish("/bank", error, "Check deposited. Cha-ching.");
}

export async function voidCheck(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_check", { p_check_id: int(fd, "id") });
  finish("/bank", error, "Check voided and funds returned.");
}
