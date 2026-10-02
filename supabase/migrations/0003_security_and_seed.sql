-- ---------------------------------------------------------------------------
-- Privileges & RLS
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- callable game functions
grant execute on function
  public.username_available(text),
  public.price(text),
  public.horse_age_on(date, int, date),
  public.breeding_block_reason(uuid, date)
to anon, authenticated;

grant execute on function
  public.send_money(text, bigint, text),
  public.write_check(text, bigint, text),
  public.deposit_check(bigint),
  public.void_check(bigint),
  public.launch_stable(text, text, text, text, text, int),
  public.buy_land(int),
  public.sell_land(int),
  public.build_facility(text, text, text, text, int, text[], text),
  public.upgrade_facility(uuid, text, int, text[]),
  public.create_horse(text, text, int, text, text, text, numeric, date, text, text, text, text, text, text),
  public.register_foal(uuid, uuid, date, text, text, text, int, text, text, boolean),
  public.age_up_foal(uuid, boolean),
  public.set_horse_status(uuid, text),
  public.geld_horse(uuid),
  public.buy_horse(uuid),
  public.offer_horse(uuid, text, bigint, text),
  public.respond_offer(bigint, boolean),
  public.open_shop(text, text),
  public.buy_item(uuid, int),
  public.found_association(text, text, text, text, text, bigint),
  public.join_association(uuid),
  public.create_thread(int, text, text, text, uuid, date, text[], bigint),
  public.enter_show(bigint, uuid, text),
  public.set_show_status(bigint, text),
  public.set_placing(bigint, int),
  public.moderate_thread(bigint, boolean, boolean)
to authenticated;

-- cosmetic column-level updates
grant update (display_name, bio, avatar_url) on public.profiles to authenticated;
grant update (name, tagline, description, location_city, location_region, location_country, terrain, specialties, banner_url) on public.stables to authenticated;
grant update (name, dimensions, description) on public.facilities to authenticated;
grant delete on public.facilities to authenticated;
grant update (registered_name, barn_name, color, markings, height_hands, discipline, personality, blurb, about, image_url,
  for_sale, sale_price, at_stud, stud_fee) on public.horses to authenticated;
grant update (description, rules, logo_url, membership_fee) on public.associations to authenticated;
grant delete on public.association_members to authenticated;
grant update (name, description, banner_url, is_open) on public.shops to authenticated;
grant insert, update, delete on public.shop_items to authenticated;
grant insert on public.forum_posts to authenticated;
grant update (body, edited_at) on public.forum_posts to authenticated;
grant update (title) on public.forum_threads to authenticated;

alter table public.price_list enable row level security;
alter table public.facility_types enable row level security;
alter table public.footing_types enable row level security;
alter table public.facility_features enable row level security;
alter table public.profiles enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.ledger enable row level security;
alter table public.checks enable row level security;
alter table public.stables enable row level security;
alter table public.facilities enable row level security;
alter table public.associations enable row level security;
alter table public.association_members enable row level security;
alter table public.breeds enable row level security;
alter table public.horses enable row level security;
alter table public.horse_ownership enable row level security;
alter table public.transfer_offers enable row level security;
alter table public.shops enable row level security;
alter table public.shop_items enable row level security;
alter table public.inventory enable row level security;
alter table public.shop_orders enable row level security;
alter table public.forum_categories enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_posts enable row level security;
alter table public.show_entries enable row level security;

-- public reads
create policy "public read" on public.price_list for select using (true);
create policy "public read" on public.facility_types for select using (true);
create policy "public read" on public.footing_types for select using (true);
create policy "public read" on public.facility_features for select using (true);
create policy "public read" on public.profiles for select using (true);
create policy "public read" on public.stables for select using (true);
create policy "public read" on public.facilities for select using (true);
create policy "public read" on public.associations for select using (true);
create policy "public read" on public.association_members for select using (true);
create policy "public read" on public.breeds for select using (true);
create policy "public read" on public.horses for select using (true);
create policy "public read" on public.horse_ownership for select using (true);
create policy "public read" on public.shops for select using (true);
create policy "public read" on public.shop_items for select using (true);
create policy "public read" on public.forum_categories for select using (true);
create policy "public read" on public.forum_threads for select using (true);
create policy "public read" on public.forum_posts for select using (true);
create policy "public read" on public.show_entries for select using (true);

-- private reads
create policy "own account" on public.bank_accounts for select to authenticated using (profile_id = auth.uid());
create policy "own ledger" on public.ledger for select to authenticated using (account_id = auth.uid());
create policy "my checks" on public.checks for select to authenticated using (auth.uid() in (writer_id, payee_id));
create policy "my offers" on public.transfer_offers for select to authenticated using (auth.uid() in (from_id, to_id));
create policy "own inventory" on public.inventory for select to authenticated using (owner_id = auth.uid());
create policy "my orders" on public.shop_orders for select to authenticated using (auth.uid() in (buyer_id, seller_id));

-- owner writes
create policy "edit self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "edit own stable" on public.stables for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "edit own facility" on public.facilities for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "demolish own facility" on public.facilities for delete to authenticated using (owner_id = auth.uid());
create policy "edit own horse" on public.horses for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "founder edits" on public.associations for update to authenticated using (founder_id = auth.uid()) with check (founder_id = auth.uid());
create policy "leave association" on public.association_members for delete to authenticated using (profile_id = auth.uid() and role <> 'president');
create policy "edit own shop" on public.shops for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "stock own shop" on public.shop_items for insert to authenticated
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()) and special is null);
create policy "edit own items" on public.shop_items for update to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()) and special is null);
create policy "remove own items" on public.shop_items for delete to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));
create policy "reply" on public.forum_posts for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.forum_threads t where t.id = thread_id and not t.locked));
create policy "edit own post" on public.forum_posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "edit own thread" on public.forum_threads for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: one public bucket, players write only inside their own folder
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 4194304, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

create policy "upload own images" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own images" on storage.objects for update to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own images" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Seed the forum with a welcome + guide thread (staff posts have no author)
-- ---------------------------------------------------------------------------

with t as (
  insert into public.forum_threads (category_id, author_id, title, pinned, locked, post_count)
  values ((select id from public.forum_categories where slug = 'announcements'), null, 'Welcome to Cavaletti!', true, true, 0)
  returning id
)
insert into public.forum_posts (thread_id, author_id, body)
select id, null, E'[b]Welcome to Cavaletti.[/b]\n\nThe main site is your paperwork: bank, land, horses, pedigrees, shops, associations. The forum is where the actual game happens: sales, shows, stud ads, barn drama, and asking how on earth breeding works.\n\nEvery new account starts with [b]$50,000[/b] and [b]1 age-up credit[/b]. Spend wisely. Or don''t. It''s pretend money and we support your journey.\n\nStart here:\n1. Launch your stable (Stable → Launch). You need at least 1 acre.\n2. Import a foundation horse or buy one from the market.\n3. Read the Player Guide.\n4. Introduce yourself in Stable Life.'
from t;

with t as (
  insert into public.forum_threads (category_id, author_id, title, pinned, locked, post_count)
  values ((select id from public.forum_categories where slug = 'player-guide'), null, 'Player Guide: the rules in one place', true, true, 0)
  returning id
)
insert into public.forum_posts (thread_id, author_id, body)
select id, null, E'[b]Time[/b]\nCavaletti runs 1:1 with real life. One year out here = one year in game. Horses age on their foaling date.\n\n[b]Land[/b]\nEvery horse living on your property needs its own acre. Land is sold by the acre from the Land Office on your stable management page. Record-only and deceased horses don''t need pasture.\n\n[b]Breeding[/b]\n- Mares and stallions can breed from age 3.\n- Mares retire from breeding after 24, stallions after 30.\n- Geldings can''t breed (obviously).\n- One foal per mare per 11 months.\n- Foals average their parents'' stats with a little luck mixed in.\n\n[b]Retroactive breeding[/b]\nGot a 10-year-old mare? She could''ve had foals in past years. Register those foals with a past foaling date and they''ll show up in pedigrees. Keep them on the farm (needs an acre) or mark them record-only if they were sold off years ago.\n\n[b]Age-ups[/b]\nA 0-year-old foal can be fast-forwarded 3 years, once, so it can show. Use a credit or pay the fee.\n\n[b]Sales & transfers[/b]\nList a horse for sale and anyone can buy it instantly. Or send a private transfer offer to a specific player, with or without a price.\n\n[b]Money[/b]\nWire transfers are instant. Checks hold the money until the payee deposits them (and you can void an un-cashed check).\n\n[b]Shows[/b]\nShows run in the forum. Start a Show thread, list your classes and entry fee, and players enter right from the thread. Close entries, place the classes, publish results. Placings go on each horse''s permanent show record.'
from t;
