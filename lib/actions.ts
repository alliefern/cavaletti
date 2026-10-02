import { redirect } from "next/navigation";

/** Redirect back with a flash message. Postgres error text is already player-friendly. */
export function finish(path: string, error: { message: string } | null | undefined, ok?: string): never {
  const sep = path.includes("?") ? "&" : "?";
  if (error) redirect(`${path}${sep}error=${encodeURIComponent(error.message.slice(0, 300))}`);
  redirect(ok ? `${path}${sep}ok=${encodeURIComponent(ok)}` : path);
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function num(fd: FormData, key: string): number | null {
  const raw = str(fd, key).replace(/[$,\s]/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function int(fd: FormData, key: string): number | null {
  const n = num(fd, key);
  return n === null ? null : Math.trunc(n);
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}
