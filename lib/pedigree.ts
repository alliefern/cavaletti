import type { SupabaseClient } from "@supabase/supabase-js";

export type PedNode = {
  id: string | null;
  name: string;
  sex?: string;
  color?: string | null;
  breed?: string | null;
  reg?: number | null;
} | null;

type Row = {
  id: string;
  registered_name: string;
  sex: string;
  color: string | null;
  reg_number: number;
  sire_id: string | null;
  dam_id: string | null;
  sire_name: string | null;
  dam_name: string | null;
  breeds: { name: string } | null;
};

/**
 * Returns generations of ancestors in classic pedigree order:
 * gens[0] = [sire, dam], gens[1] = [sire's sire, sire's dam, dam's sire, dam's dam], ...
 * Unrecorded foundation ancestors (only a name on paper) show up as nodes with id = null.
 */
export async function loadPedigree(
  supabase: SupabaseClient,
  horse: Pick<Row, "sire_id" | "dam_id" | "sire_name" | "dam_name">,
  depth = 3,
): Promise<PedNode[][]> {
  const gens: PedNode[][] = [];
  let current: (Pick<Row, "sire_id" | "dam_id" | "sire_name" | "dam_name"> | null)[] = [horse];

  for (let g = 0; g < depth; g++) {
    const ids = current.flatMap((h) => (h ? [h.sire_id, h.dam_id] : [])).filter((x): x is string => !!x);
    const byId = new Map<string, Row>();
    if (ids.length) {
      const { data } = await supabase
        .from("horses")
        .select("id, registered_name, sex, color, reg_number, sire_id, dam_id, sire_name, dam_name, breeds(name)")
        .in("id", ids);
      (data as unknown as Row[] | null)?.forEach((r) => byId.set(r.id, r));
    }

    const nodes: PedNode[] = [];
    const next: (Row | null)[] = [];
    for (const h of current) {
      for (const side of ["sire", "dam"] as const) {
        const id = h?.[`${side}_id`] ?? null;
        const name = h?.[`${side}_name`] ?? null;
        const row = id ? byId.get(id) ?? null : null;
        if (row) {
          nodes.push({
            id: row.id,
            name: row.registered_name,
            sex: row.sex,
            color: row.color,
            breed: row.breeds?.name ?? null,
            reg: row.reg_number,
          });
          next.push(row);
        } else if (name) {
          nodes.push({ id: null, name });
          next.push(null);
        } else {
          nodes.push(null);
          next.push(null);
        }
      }
    }
    gens.push(nodes);
    current = next;
  }
  return gens;
}
