import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { openShop } from "@/app/actions/social";
import { Flash, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { money } from "@/lib/format";

export const metadata = { title: "Shops" };

export default async function Shops({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();
  const [{ data: shops }, { data: license }] = await Promise.all([
    supabase.from("shops").select("id, name, description, is_open, owner_id, profiles(username), shop_items(id)").order("created_at"),
    supabase.from("price_list").select("amount").eq("key", "shop_license").single(),
  ]);
  const official = (shops ?? []).filter((s: any) => !s.owner_id);
  const players = (shops ?? []).filter((s: any) => s.owner_id);

  return (
    <>
      <h1>Shops</h1>
      <Flash sp={sp} />
      {official.map((s: any) => (
        <div className="box" key={s.id}>
          <div className="box-title">
            {s.name} <Link href={`/shops/${s.id}`}>browse →</Link>
          </div>
          <div className="box-body">{s.description}</div>
        </div>
      ))}

      <h2>Player shops</h2>
      {players.length ? (
        <table className="list">
          <thead>
            <tr>
              <th>Shop</th>
              <th>Owner</th>
              <th className="num">Items</th>
            </tr>
          </thead>
          <tbody>
            {players.map((s: any) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/shops/${s.id}`}>
                    <strong>{s.name}</strong>
                  </Link>{" "}
                  {!s.is_open && <span className="pill">closed</span>}
                  {s.description && <div className="small muted">{s.description.slice(0, 140)}</div>}
                </td>
                <td>
                  <Link href={`/stables/${s.profiles?.username}`}>{s.profiles?.username}</Link>
                </td>
                <td className="num">{s.shop_items?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty">No player shops yet. Tack, art commissions, training services… somebody open one.</div>
      )}

      {viewer && (
        <div className="box" style={{ marginTop: 18 }}>
          <div className="box-title">Open your own shop</div>
          <div className="box-body">
            <p className="mt0 small">
              License fee <strong>{money(license?.amount)}</strong>. Sell tack, feed, graphics, lessons, training, anything
              you can describe. Sales go straight into your bank account.
            </p>
            <form action={openShop} className="stack">
              <div className="field">
                <label>Shop name</label>
                <input name="name" required minLength={3} maxLength={80} />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea name="description" rows={3} />
              </div>
              <SubmitButton className="btn btn-small">Open shop</SubmitButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
