import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { depositCheck, sendMoney, voidCheck, writeCheck } from "@/app/actions/bank";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { dateTime, money } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Bank" };

const KIND_LABEL: Record<string, string> = {
  starting_balance: "Opening deposit",
  transfer: "Wire transfer",
  check_written: "Check written",
  check_deposited: "Check deposited",
  check_voided: "Check voided",
  land: "Land purchase",
  land_sale: "Land sale",
  facility: "Construction",
  horse_creation: "Horse import",
  foal_registration: "Foal registration",
  stud_fee: "Stud fee",
  age_up: "Age-up",
  horse_sale: "Horse sale",
  horse_transfer: "Horse transfer",
  shop_purchase: "Shop",
  shop_license: "Shop license",
  association_charter: "Association charter",
  association_dues: "Association dues",
  show_entry: "Show entry",
};

export default async function Bank({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireViewer("/bank");
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: ledger }, { data: checks }] = await Promise.all([
    supabase
      .from("ledger")
      .select("id, delta, balance_after, kind, memo, created_at, counterparty:profiles!ledger_counterparty_id_fkey(username)")
      .eq("account_id", viewer.id)
      .order("id", { ascending: false })
      .limit(150),
    supabase
      .from("checks")
      .select("id, check_number, amount, memo, status, created_at, writer_id, payee_id, writer:profiles!checks_writer_id_fkey(username), payee:profiles!checks_payee_id_fkey(username)")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const toDeposit = (checks ?? []).filter((c: any) => c.payee_id === viewer.id && c.status === "pending");
  const outstanding = (checks ?? []).filter((c: any) => c.writer_id === viewer.id && c.status === "pending");

  return (
    <>
      <h1>First Bank of Cavaletti</h1>
      <Flash sp={sp} />
      <div className="grid-3">
        <div className="box">
          <div className="box-title">Balance</div>
          <div className="box-body">
            <div className="big-number">{money(viewer.balance)}</div>
            <div className="small muted">
              {viewer.ageCredits} age-up credit{viewer.ageCredits === 1 ? "" : "s"} · account #{viewer.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>
        <div className="box">
          <div className="box-title">Wire transfer</div>
          <div className="box-body">
            <form action={sendMoney} className="stack">
              <input name="to" placeholder="Username" defaultValue={sp.to ?? ""} required />
              <input name="amount" type="number" min={1} placeholder="Amount" required />
              <input name="memo" placeholder="Memo (optional)" maxLength={200} />
              <SubmitButton className="btn btn-small">Send now</SubmitButton>
            </form>
            <p className="small muted">Instant and final.</p>
          </div>
        </div>
        <div className="box">
          <div className="box-title">Write a check</div>
          <div className="box-body">
            <form action={writeCheck} className="stack">
              <input name="to" placeholder="Pay to the order of…" defaultValue={sp.to ?? ""} required />
              <input name="amount" type="number" min={1} placeholder="Amount" required />
              <input name="memo" placeholder="Memo" maxLength={200} />
              <SubmitButton className="btn btn-small btn-brown">Sign &amp; send</SubmitButton>
            </form>
            <p className="small muted">Funds are held until they deposit it. You can void it until then.</p>
          </div>
        </div>
      </div>

      {toDeposit.length > 0 && (
        <>
          <h2>Checks waiting for you</h2>
          <div className="grid-2">
            {toDeposit.map((c: any) => (
              <div key={c.id} className="check-paper">
                <span className="check-no">No. {c.check_number}</span>
                <div className="small muted">{dateTime(c.created_at)}</div>
                <div>
                  Pay to the order of <strong>{viewer.username}</strong>
                </div>
                <div className="big-number">{money(c.amount)}</div>
                <div className="small">
                  From <strong>{c.writer?.username}</strong>
                  {c.memo && <> · Memo: {c.memo}</>}
                </div>
                <form action={depositCheck} style={{ marginTop: 8 }}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton className="btn btn-small">Deposit</SubmitButton>
                </form>
              </div>
            ))}
          </div>
        </>
      )}

      {outstanding.length > 0 && (
        <>
          <h2>Your outstanding checks</h2>
          <table className="list">
            <tbody>
              {outstanding.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    #{c.check_number} to <Link href={`/stables/${c.payee?.username}`}>{c.payee?.username}</Link>
                    {c.memo && <span className="muted small"> · {c.memo}</span>}
                  </td>
                  <td className="num">{money(c.amount)}</td>
                  <td className="right">
                    <form action={voidCheck}>
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton className="btn btn-small btn-ghost" confirm="Void this check and get the money back?">
                        Void
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Statement</h2>
      <div className="table-wrap">
        <table className="list">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Details</th>
              <th className="num">Amount</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledger?.map((l: any) => (
              <tr key={l.id}>
                <td className="nowrap small">{dateTime(l.created_at)}</td>
                <td className="nowrap">{KIND_LABEL[l.kind] ?? l.kind}</td>
                <td className="small">
                  {l.memo}
                  {l.counterparty && <span className="muted"> · {l.delta > 0 ? "from" : "to"} {l.counterparty.username}</span>}
                </td>
                <td className={`num ${l.delta > 0 ? "pos" : "neg"}`}>
                  {l.delta > 0 ? "+" : "−"}
                  {money(Math.abs(l.delta))}
                </td>
                <td className="num">{money(l.balance_after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
