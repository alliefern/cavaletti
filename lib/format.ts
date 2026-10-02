export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `$${v.toLocaleString("en-US")}`;
}

export function regNumber(n: number | string): string {
  return `CV-${String(n).padStart(6, "0")}`;
}

/** Whole years between birth and `on`, plus purchased age-up years. Mirrors horse_age_on() in SQL. */
export function horseAge(birthDate: string, bonus = 0, on: Date = new Date()): number {
  const b = new Date(birthDate + "T00:00:00Z");
  let years = on.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < b.getUTCMonth() || (on.getUTCMonth() === b.getUTCMonth() && on.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years + (bonus ?? 0);
}

export function ageLabel(birthDate: string, bonus = 0): string {
  const a = horseAge(birthDate, bonus);
  return a === 1 ? "1 yr" : `${a} yrs`;
}

export function breedingStatus(h: {
  sex: string;
  birth_date: string;
  age_bonus_years: number;
  status: string;
}): { ok: boolean; label: string } {
  if (h.sex === "gelding") return { ok: false, label: "Gelding" };
  if (h.status === "deceased") return { ok: false, label: "Deceased" };
  const age = horseAge(h.birth_date, h.age_bonus_years);
  if (age < 3) return { ok: false, label: "Too young" };
  if (h.sex === "mare" && age > 24) return { ok: false, label: "Retired from breeding" };
  if (h.sex === "stallion" && age > 30) return { ok: false, label: "Retired from breeding" };
  return { ok: true, label: "Breedable" };
}

export function date(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = d.length === 10 ? new Date(d + "T00:00:00Z") : new Date(d);
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function dateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function sexLabel(sex: string): string {
  return sex === "mare" ? "Mare" : sex === "stallion" ? "Stallion" : "Gelding";
}

export function sexIcon(sex: string): string {
  return sex === "mare" ? "♀" : sex === "stallion" ? "♂" : "⚲";
}

export function location(s: {
  location_city?: string | null;
  location_region?: string | null;
  location_country?: string | null;
}): string {
  return [s.location_city, s.location_region, s.location_country].filter(Boolean).join(", ") || "Parts unknown";
}

export const today = () => new Date().toISOString().slice(0, 10);
