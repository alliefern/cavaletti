# Cavaletti

An old-school horse sim. The main site holds the paperwork: bank, land, stables, horses, pedigrees, breed associations, and shops. The forum is where the game actually happens: sales, shows, stud ads, and barn life. One account works across both.

## What's in it

- **Accounts.** Email + password sign-up, login, and password reset (Supabase Auth). New players start with $50,000 and 1 age-up credit.
- **Stables.** Launch a stable with a name and location, buy land by the acre (1 acre per horse on the property), and build facilities. Pick footing, dimensions, stall counts, and extras like lights, mirrors, or a viewing deck. Every stable gets a public page with its horses and facilities.
- **Horses.** Foundation imports (stats rolled at random), photo uploads, a blurb and about section, 7 stats, a 3-generation pedigree, offspring, show record, and ownership history.
- **Aging is 1:1 with real time.** A 0-year-old foal can be aged up 3 years once, using a credit or cash.
- **Breeding.** Mares and stallions breed from 3. Mares retire after 24, stallions after 30, geldings never. One foal per mare per 11 months. **Retroactive breeding** works too: register past foals with a past foaling date, then keep them on the farm or mark them record-only.
- **Market.** List horses for sale (instant buy), stand stallions at stud (fee goes to the owner), or send private transfer offers to a specific player.
- **Bank.** Statement, instant wire transfers, and checks (held until deposited, voidable until then).
- **Associations.** Official in-world breed registries, plus player-chartered clubs with dues.
- **Shops.** The General Store (age-up credits, tack, feed) plus player-run shops.
- **Forum.** Categories, BBCode, sale and stud threads with live Buy/Book buttons, and **show threads** with classes, entry fees, entries, placings, and published results that land on each horse's show record.

## Stack

- Next.js 15 (App Router, server actions) on Vercel
- Supabase: Postgres, Auth, and Storage (`images` bucket)

All game rules live in Postgres `SECURITY DEFINER` functions (`supabase/migrations/0002_game_functions.sql`). Row-level security plus column-level grants mean players can only edit cosmetic fields directly. Money, land, horses, and stats only move through the rules.

## Setup

1. Apply the migrations in `supabase/migrations/` in order (or link the Supabase project and run `supabase db push`).
2. Set env vars (the Vercel ↔ Supabase integration does this automatically):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. In Supabase → Authentication → URL Configuration, set the **Site URL** to your production domain and add `https://<your-domain>/auth/callback` to the redirect allow-list.
4. Supabase's built-in email sender only delivers to your own team's addresses and is heavily rate-limited. Before inviting players, add custom SMTP (Authentication → Emails → SMTP settings, e.g. Resend or Postmark) so confirmation and reset emails arrive.

```bash
npm install
npm run dev
```

## Making someone staff

Staff can post in Announcements and pin/lock threads:

```sql
update public.profiles set is_admin = true where lower(username) = lower('their_username');
```

## Tuning the economy

Prices live in tables, not code. Change them in SQL and every page picks them up:

- `price_list`: land, imports, registration, age-ups, licenses, stalls, extras
- `facility_types`, `footing_types`, `facility_features`
