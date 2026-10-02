import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { addItem, buyItem, removeItem, updateShop } from "@/app/actions/social";
import { Flash, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { dateTime, money } from "@/lib/format";

export default async function ShopPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();
  const { data: shop } = await supabase.from("shops").select("*, profiles(username)").eq("id", id).maybeSingle();
  if (!shop) notFound();
  const isOwner = !!viewer && shop.owner_id === viewer.id;

  const [{ data: items }, { data: orders }] = await Promise.all([
    supabase.from("shop_items").select("*").eq("shop_id", id).eq("active", true).order("category").order("price"),
    isOwner
      ? supabase.from("shop_orders").select("id, item_name, quantity, total, created_at, buyer:profiles!shop_orders_buyer_id_fkey(username)").eq("shop_id", id).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return (
    <>
      <Flash sp={sp} />
      <h1 style={{ marginBottom: 0 }}>{shop.name}</h1>
      <p className="horse-sub">
        {shop.owner_id ? (
          <>
            Run by <Link href={`/stables/${shop.profiles?.username}`}>{shop.profiles?.username}</Link>
          </>
        ) : (
          "Official Cavaletti store"
        )}
        {!shop.is_open && " · Closed right now"}
      </p>
      {shop.description && <p className="prose">{shop.description}</p>}

      {items?.length ? (
        <div className="table-wrap">
          <table className="list">
            <thead>
              <tr>
                <th></th>
                <th>Item</th>
                <th>Category</th>
                <th className="num">Price</th>
                <th className="num">Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i: any) => (
                <tr key={i.id}>
                  <td style={{ width: 60 }}>
                    {i.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.image_url} alt="" style={{ width: 50, height: 50, objectFit: "cover" }} />
                    )}
                  </td>
                  <td>
                    <strong>{i.name}</strong>
                    {i.description && <div className="small muted">{i.description}</div>}
                  </td>
                  <td className="small">{i.category}</td>
                  <td className="num">{money(i.price)}</td>
                  <td className="num">{i.stock ?? "∞"}</td>
                  <td className="right nowrap">
                    {viewer && !isOwner && shop.is_open && (
                      <form action={buyItem} className="row" style={{ justifyContent: "flex-end" }}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="shop_id" value={shop.id} />
                        <input name="qty" type="number" min={1} max={i.stock ?? 999} defaultValue={1} style={{ width: 64 }} />
                        <SubmitButton className="btn btn-small">Buy</SubmitButton>
                      </form>
                    )}
                    {isOwner && (
                      <form action={removeItem}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="shop_id" value={shop.id} />
                        <SubmitButton className="btn btn-small btn-ghost" confirm="Pull this item?">
                          Remove
                        </SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">Shelves are empty.</div>
      )}
      {!viewer && (
        <p>
          <Link href={`/login?next=/shops/${shop.id}`}>Log in</Link> to shop.
        </p>
      )}

      {isOwner && (
        <>
          <h2>Shopkeeper’s counter</h2>
          <div className="grid-2">
            <div className="box">
              <div className="box-title">Stock a new item</div>
              <div className="box-body">
                <form action={addItem} className="stack">
                  <input type="hidden" name="shop_id" value={shop.id} />
                  <div className="field">
                    <label>Item name</label>
                    <input name="name" required minLength={2} maxLength={80} />
                  </div>
                  <div className="fields-3">
                    <div className="field">
                      <label>Price</label>
                      <input name="price" type="number" min={0} required />
                    </div>
                    <div className="field">
                      <label>Stock</label>
                      <input name="stock" type="number" min={0} placeholder="∞" />
                    </div>
                    <div className="field">
                      <label>Category</label>
                      <input name="category" maxLength={40} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Description</label>
                    <textarea name="description" rows={3} maxLength={1000} />
                  </div>
                  <div className="field">
                    <label>Image</label>
                    <input name="image" type="file" accept="image/*" />
                  </div>
                  <SubmitButton className="btn btn-small">Add item</SubmitButton>
                </form>
              </div>
            </div>
            <div>
              <div className="box">
                <div className="box-title">Shop settings</div>
                <div className="box-body">
                  <form action={updateShop} className="stack">
                    <input type="hidden" name="id" value={shop.id} />
                    <div className="field">
                      <label>Name</label>
                      <input name="name" defaultValue={shop.name} required minLength={3} maxLength={80} />
                    </div>
                    <div className="field">
                      <label>Description</label>
                      <textarea name="description" defaultValue={shop.description ?? ""} rows={3} />
                    </div>
                    <label className="small">
                      <input type="checkbox" name="is_open" defaultChecked={shop.is_open} /> Open for business
                    </label>
                    <SubmitButton className="btn btn-small">Save</SubmitButton>
                  </form>
                </div>
              </div>
              <div className="box">
                <div className="box-title">Recent sales</div>
                <div className="box-body small">
                  {orders?.length ? (
                    orders.map((o: any) => (
                      <div key={o.id}>
                        {o.buyer?.username} bought {o.quantity}× {o.item_name} for {money(o.total)}{" "}
                        <span className="muted">{dateTime(o.created_at)}</span>
                      </div>
                    ))
                  ) : (
                    <span className="muted">No sales yet.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
