import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { Flash, type SP } from "@/components/Flash";
import { HorseTable, HORSE_ROW_SELECT, type HorseRow } from "@/components/HorseTable";
import { SubmitButton } from "@/components/SubmitButton";
import { respondOffer } from "@/app/actions/horses";
import { money } from "@/lib/format";

export const metadata = { title: "My Barn" };

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const viewer = await requireViewer("/dashboard");
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: horses }, { data: offers }, { data: checks }, { data: inventory }, { count: facilityCount }] = await Promise.all([
    supabase.from("horses").select(HORSE_ROW_SELECT).eq("owner_id", viewer.id).order("registered_name"),
    supabase
      .from("transfer_offers")
      .select("id, price, note, from_id, to_id, horses(id, registered_name), from:profiles!transfer_offers_from_id_fkey(username), to:profiles!transfer_offers_to_id_fkey(username)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("checks").select("id").eq("payee_id", viewer.id).eq("status", "pending"),
    supabase.from("inventory").select("id, name, quantity").eq("owner_id", viewer.id).gt("quantity", 0).order("name"),
    supabase.from("facilities").select("id", { count: "exact", head: true }).eq("owner_id", viewer.id),
  ]);

  const all = (horses ?? []) as unknown as HorseRow[];
  const onProperty = all.filter((h) => h.status === "active" || h.status === "retired");
  const records = all.filter((h) => h.status === "record" || h.status === "deceased");
  const incoming = (offers ?? []).filter((o: any) => o.to_id === viewer.id);
  const outgoing = (offers ?? []).filter((o: any) => o.from_id === viewer.id);
  const acres = viewer.stable?.acres ?? 0;

  return (
    <>
      <h1>My Barn</h1>
      <Flash sp={sp} />

      {!viewer.stable?.launched && (
        <div className="flash flash-ok">
          🐴 <strong>First things first:</strong> your stable isn’t open yet. <Link href="/stable">Launch it</Link> (name
          it, pick a location, buy at least 1 acre), then you can bring horses home.
        </div>
      )}

      <div className="grid-3">
        <div className="box">
          <div className="box-title">
            Bank <Link href="/bank">open →</Link>
          </div>
          <div className="box-body">
            <div className="big-number">{money(viewer.balance)}</div>
            <div className="small muted">
              {viewer.ageCredits} age-up credit{viewer.ageCredits === 1 ? "" : "s"}
              {checks?.length ? (
                <>
                  {" "}
                  · <Link href="/bank">{checks.length} check(s) to deposit</Link>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="box">
          <div className="box-title">
            Stable <Link href="/stable">manage →</Link>
          </div>
          <div className="box-body">
            <div className="big-number">
              {onProperty.length} / {acres}
            </div>
            <div className="small muted">
              horses / acres · {facilityCount ?? 0} facilities
              {viewer.stable?.launched && (
                <>
                  {" "}
                  · <Link href={`/stables/${viewer.username}`}>public page</Link>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="box">
          <div className="box-title">Quick Actions</div>
          <div className="box-body row">
            <Link className="btn btn-small" href="/horses/new">
              + New horse
            </Link>
            <Link className="btn btn-small btn-brown" href="/breeding">
              Breed
            </Link>
            <Link className="btn btn-small btn-ghost" href="/market">
              Market
            </Link>
            <Link className="btn btn-small btn-ghost" href="/settings">
              Profile
            </Link>
          </div>
        </div>
      </div>

      {incoming.length > 0 && (
        <div className="box">
          <div className="box-title">Horses offered to you</div>
          <div className="box-body">
            <table className="list">
              <tbody>
                {incoming.map((o: any) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.from?.username}</strong> wants to transfer{" "}
                      <Link href={`/horses/${o.horses?.id}`}>{o.horses?.registered_name}</Link> to you{" "}
                      {o.price > 0 ? <>for <strong>{money(o.price)}</strong></> : <>for free</>}
                      {o.note && <div className="small muted">“{o.note}”</div>}
                    </td>
                    <td className="right nowrap">
                      <form action={respondOffer} className="row" style={{ justifyContent: "flex-end" }}>
                        <input type="hidden" name="offer" value={o.id} />
                        <input type="hidden" name="back" value="/dashboard" />
                        <SubmitButton className="btn btn-small" name="answer" value="accept">
                          Accept
                        </SubmitButton>
                        <SubmitButton className="btn btn-small btn-ghost" name="answer" value="decline">
                          Decline
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="box">
          <div className="box-title">Your pending transfer offers</div>
          <div className="box-body">
            <table className="list">
              <tbody>
                {outgoing.map((o: any) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/horses/${o.horses?.id}`}>{o.horses?.registered_name}</Link> → {o.to?.username}{" "}
                      {o.price > 0 ? `for ${money(o.price)}` : "(free)"}
                    </td>
                    <td className="right">
                      <form action={respondOffer}>
                        <input type="hidden" name="offer" value={o.id} />
                        <input type="hidden" name="back" value="/dashboard" />
                        <SubmitButton className="btn btn-small btn-ghost" name="answer" value="cancel">
                          Cancel
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2>On the property ({onProperty.length})</h2>
      <HorseTable horses={onProperty} empty="No horses yet. Import a foundation horse or shop the market." />

      {records.length > 0 && (
        <>
          <h2>Records &amp; memorials ({records.length})</h2>
          <p className="small muted">
            Record-only horses (retro foals you sold years ago) and horses that crossed the rainbow bridge. They live on in
            pedigrees and don’t need an acre.
          </p>
          <HorseTable horses={records} />
        </>
      )}

      <h2>Tack trunk</h2>
      {inventory?.length ? (
        <p>
          {inventory.map((i: any, idx: number) => (
            <span key={i.id}>
              {idx > 0 && " · "}
              {i.name} ×{i.quantity}
            </span>
          ))}
        </p>
      ) : (
        <div className="empty">
          Empty. The <Link href="/shops">shops</Link> would love to fix that.
        </div>
      )}
    </>
  );
}
