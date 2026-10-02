import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";

export const metadata = { title: "Player Guide" };

export default async function Guide() {
  const supabase = await createClient();
  const { data: prices } = await supabase.from("price_list").select("*").order("sort");
  const p = Object.fromEntries((prices ?? []).map((x: any) => [x.key, Number(x.amount)]));

  return (
    <div className="sidebar-layout">
      <div>
        <h1>Player Guide</h1>
        <p>
          Everything you need to not embarrass yourself at your first show. For questions this doesn’t answer, the{" "}
          <Link href="/forum/questions">Questions &amp; Help</Link> board is full of people who love explaining things.
        </p>

        <h2 id="start">Getting started</h2>
        <ol>
          <li>
            <strong>Make an account.</strong> You get {money(p.starting_balance)} and one age-up credit. One login works on
            the whole site and the forum.
          </li>
          <li>
            <strong>Launch your stable.</strong> Name it, set your location, and buy land. Minimum 1 acre.
          </li>
          <li>
            <strong>Get horses.</strong> Import a foundation horse ({money(p.horse_creation)}) or buy one on the{" "}
            <Link href="/market">Market</Link>.
          </li>
          <li>
            <strong>Build it out.</strong> Barns, arenas, round pens, tracks. Pick the footing, the size, the stalls, the extras.
          </li>
          <li>
            <strong>Go play on the forum.</strong> Sales, shows, stud ads, and barn life all happen there.
          </li>
        </ol>

        <h2 id="time">Time &amp; aging</h2>
        <p>
          Cavaletti runs <strong>1:1 with real life</strong>. A horse foaled today turns 1 a year from today. No game
          years, no speed-ups, except one:
        </p>
        <p>
          <strong>Age-ups.</strong> A 0-year-old foal can be fast-forwarded <strong>+3 years, once</strong>, so it can
          show and eventually breed. Use an age-up credit or pay {money(p.age_up)}. Extra credits are sold in the{" "}
          <Link href="/shops">General Store</Link>.
        </p>

        <h2 id="land">Land &amp; facilities</h2>
        <ul>
          <li>Land costs {money(p.land_acre)}/acre. Every horse on your property needs its own acre.</li>
          <li>
            Retired horses still need an acre. <em>Record-only</em> horses (sold off years ago) and deceased horses don’t.
          </li>
          <li>Sell land back at {p.land_sellback_pct}% of the purchase price, as long as your herd still fits.</li>
          <li>
            Facilities have a base price, plus footing (arenas, pens, tracks), plus {money(p.stall)} per stall (barns), plus{" "}
            {money(p.facility_feature)} per extra (lights, mirrors, viewing deck, etc.). Upgrade any time.
          </li>
        </ul>

        <h2 id="breeding">Breeding</h2>
        <ul>
          <li>Mares and stallions can breed from age <strong>3</strong>.</li>
          <li>
            Mares retire from breeding after <strong>24</strong>, stallions after <strong>30</strong>. Geldings never.
          </li>
          <li>
            One foal per mare every <strong>11 months</strong>.
          </li>
          <li>
            You must own the mare. The stallion can be yours or anyone’s standing at stud. The stud fee goes straight to his
            owner.
          </li>
          <li>Registration is {money(p.foal_registration)} per foal.</li>
          <li>Foals inherit the average of their parents’ stats with a little random luck on top.</li>
          <li>Foals can be registered as the sire’s breed, the dam’s breed, or Grade / Crossbred.</li>
        </ul>

        <h3 id="retro">Retroactive breeding</h3>
        <p>
          Import a 10-year-old mare and she’s had years of breeding life before she got here. Register those foals with a{" "}
          <strong>past foaling date</strong>. Say she had a filly in 2020: pick 2020 as the foaling date and the filly goes
          on paper, in her pedigree, forever. Same rules apply: both parents had to be 3+ and not retired from breeding on
          that date, and foals still need 11 months between them.
        </p>
        <p>
          Retro foals can come home (needs an acre) or be marked <strong>record only</strong> if they were sold off years
          ago and you just want them in the books.
        </p>

        <h2 id="money">Money</h2>
        <ul>
          <li>
            <strong>Wire transfers</strong> are instant and final.
          </li>
          <li>
            <strong>Checks</strong> take the money out of your account when you write them, so they can’t bounce. The
            payee deposits it whenever. You can void a check until it’s deposited.
          </li>
          <li>All money is fake. Please don’t try to sell Cavaletti dollars for real ones. It makes us sad and it’s against the rules.</li>
        </ul>

        <h2 id="sales">Selling horses</h2>
        <ul>
          <li>
            <strong>Public sale:</strong> list a horse for sale on its page. Anyone with the money and the acre can buy it
            instantly.
          </li>
          <li>
            <strong>Private transfer:</strong> send an offer to a specific player, with or without a price. It goes through
            when they accept.
          </li>
          <li>
            Post a <strong>Sale ad</strong> in <Link href="/forum/horse-sales">Horse Sales</Link> and the horse’s Buy button
            shows up right in the thread.
          </li>
        </ul>

        <h2 id="shows">Running shows</h2>
        <ol>
          <li>
            Start a <strong>Show</strong> thread in <Link href="/forum/shows">Shows &amp; Competitions</Link>. List your
            classes, a date, and an entry fee (paid to you).
          </li>
          <li>Players enter active horses aged 3+ straight from the thread.</li>
          <li>Close entries, judge however you like (stats, roll dice, vibes), and enter placings.</li>
          <li>Publish results. Placings go on every horse’s permanent show record.</li>
        </ol>

        <h2 id="conduct">Be cool</h2>
        <p>
          Be kind on the forum, don’t harass people, don’t use art you don’t have rights to, and don’t run multiple
          accounts to game the economy. Staff can lock threads and will.
        </p>
      </div>
      <aside>
        <div className="box">
          <div className="box-title">Price sheet</div>
          <div className="box-body">
            <table className="list small">
              <tbody>
                {prices
                  ?.filter((x: any) => x.key !== "land_sellback_pct")
                  .map((x: any) => (
                    <tr key={x.key}>
                      <td>{x.label}</td>
                      <td className="num">{money(x.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="box">
          <div className="box-title">Jump to</div>
          <div className="box-body small">
            {[
              ["start", "Getting started"],
              ["time", "Time & aging"],
              ["land", "Land & facilities"],
              ["breeding", "Breeding"],
              ["retro", "Retroactive breeding"],
              ["money", "Money"],
              ["sales", "Selling horses"],
              ["shows", "Running shows"],
            ].map(([id, label]) => (
              <div key={id}>
                <a href={`#${id}`}>{label}</a>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
