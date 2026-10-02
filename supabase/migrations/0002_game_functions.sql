-- ---------------------------------------------------------------------------
-- Helpers (internal: not callable from the API)
-- ---------------------------------------------------------------------------

create or replace function public.price(p_key text) returns bigint
language sql stable security definer set search_path = public as $$
  select amount from public.price_list where key = p_key
$$;

create or replace function public.horse_age_on(p_birth date, p_bonus int, p_on date)
returns int language sql stable as $$
  select (extract(year from age(p_on, p_birth))::int + coalesce(p_bonus, 0))
$$;

create or replace function public._me() returns uuid
language plpgsql stable as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'You need to be logged in.'; end if;
  return v;
end $$;

-- Move money on ONE account. Positive delta = credit.
create or replace function public._adjust(
  p_account uuid, p_delta bigint, p_kind text, p_memo text,
  p_counterparty uuid default null, p_horse uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_bal bigint;
begin
  if p_delta = 0 then return; end if;
  update public.bank_accounts
     set balance = balance + p_delta, updated_at = now()
   where profile_id = p_account and balance + p_delta >= 0
  returning balance into v_bal;
  if not found then
    raise exception 'Insufficient funds. That costs $%.', to_char(abs(p_delta), 'FM999,999,999,999');
  end if;
  insert into public.ledger (account_id, delta, balance_after, kind, memo, counterparty_id, horse_id)
  values (p_account, p_delta, v_bal, p_kind, p_memo, p_counterparty, p_horse);
end $$;

-- Payer -> payee (payee null = the game/system).
create or replace function public._pay(
  p_from uuid, p_to uuid, p_amount bigint, p_kind text, p_memo text, p_horse uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_amount < 0 then raise exception 'Amount can''t be negative.'; end if;
  if p_amount = 0 then return; end if;
  if p_from is not null then
    perform public._adjust(p_from, -p_amount, p_kind, p_memo, p_to, p_horse);
  end if;
  if p_to is not null then
    perform public._adjust(p_to, p_amount, p_kind, p_memo, p_from, p_horse);
  end if;
end $$;

create or replace function public._profile_by_username(p_username text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from public.profiles where lower(username) = lower(trim(leading '@' from trim(p_username)));
  if v is null then raise exception 'No player named "%".', p_username; end if;
  return v;
end $$;

-- Horses that need pasture: everything alive and on the property.
create or replace function public._horses_on_property(p_owner uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.horses where owner_id = p_owner and status in ('active', 'retired')
$$;

create or replace function public._require_room(p_owner uuid, p_extra int default 1) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_acres int; v_count int;
begin
  select acres into v_acres from public.stables where owner_id = p_owner;
  v_count := public._horses_on_property(p_owner);
  if coalesce(v_acres, 0) < v_count + p_extra then
    raise exception 'Not enough land. You have % acre(s) and % horse(s); every horse needs its own acre.', coalesce(v_acres, 0), v_count;
  end if;
end $$;

create or replace function public._rand_stat(p_lo int, p_hi int) returns int
language sql volatile as $$
  select p_lo + floor(random() * (p_hi - p_lo + 1))::int
$$;

create or replace function public._clamp(p int) returns int
language sql immutable as $$ select greatest(1, least(100, p)) $$;

-- ---------------------------------------------------------------------------
-- New user bootstrap
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_username text := coalesce(nullif(new.raw_user_meta_data->>'username', ''), 'rider_' || substr(replace(new.id::text, '-', ''), 1, 8));
begin
  if v_username !~ '^[A-Za-z0-9_]{3,24}$' then
    v_username := 'rider_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := left(v_username, 19) || '_' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, coalesce(new.raw_user_meta_data->>'display_name', v_username));

  insert into public.bank_accounts (profile_id, balance, age_credits) values (new.id, 0, 1);
  perform public._adjust(new.id, public.price('starting_balance'), 'starting_balance', 'Welcome to Cavaletti!');

  insert into public.stables (owner_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Player-callable game functions
-- ---------------------------------------------------------------------------

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(p_username))
$$;

-- Bank -----------------------------------------------------------------------

create or replace function public.send_money(p_to_username text, p_amount bigint, p_memo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); v_to uuid := public._profile_by_username(p_to_username);
begin
  if v_to = v_me then raise exception 'You can''t wire money to yourself. Nice try.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount over $0.'; end if;
  perform public._pay(v_me, v_to, p_amount, 'transfer', nullif(trim(p_memo), ''));
end $$;

create or replace function public.write_check(p_to_username text, p_amount bigint, p_memo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); v_to uuid := public._profile_by_username(p_to_username);
  v_num int; v_id bigint;
begin
  if v_to = v_me then raise exception 'Writing yourself a check is just called "Tuesday". Not allowed.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount over $0.'; end if;
  select coalesce(max(check_number), 1000) + 1 into v_num from public.checks where writer_id = v_me;
  -- funds are held the moment the check is written, so it can't bounce
  perform public._adjust(v_me, -p_amount, 'check_written', 'Check #' || v_num || coalesce(' — ' || nullif(trim(p_memo), ''), ''), v_to);
  insert into public.checks (check_number, writer_id, payee_id, amount, memo)
  values (v_num, v_me, v_to, p_amount, nullif(trim(p_memo), '')) returning id into v_id;
  return v_id;
end $$;

create or replace function public.deposit_check(p_check_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); c public.checks;
begin
  select * into c from public.checks where id = p_check_id for update;
  if c.id is null or c.payee_id <> v_me then raise exception 'That check isn''t made out to you.'; end if;
  if c.status <> 'pending' then raise exception 'That check was already %.', c.status; end if;
  update public.checks set status = 'deposited', resolved_at = now() where id = c.id;
  perform public._adjust(v_me, c.amount, 'check_deposited', 'Check #' || c.check_number || coalesce(' — ' || c.memo, ''), c.writer_id);
end $$;

create or replace function public.void_check(p_check_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); c public.checks;
begin
  select * into c from public.checks where id = p_check_id for update;
  if c.id is null or c.writer_id <> v_me then raise exception 'You didn''t write that check.'; end if;
  if c.status <> 'pending' then raise exception 'That check was already %.', c.status; end if;
  update public.checks set status = 'voided', resolved_at = now() where id = c.id;
  perform public._adjust(v_me, c.amount, 'check_voided', 'Voided check #' || c.check_number, c.payee_id);
end $$;

-- Stable & land ---------------------------------------------------------------

create or replace function public.launch_stable(
  p_name text, p_city text, p_region text, p_country text, p_terrain text, p_acres int
) returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); s public.stables;
begin
  select * into s from public.stables where owner_id = v_me for update;
  if s.launched then raise exception 'Your stable is already open for business.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Your stable needs a name.'; end if;
  if coalesce(trim(p_region), '') = '' and coalesce(trim(p_country), '') = '' then
    raise exception 'Set a location (at least a state/region or country).';
  end if;
  if coalesce(p_acres, 0) < 0 then raise exception 'Acres can''t be negative.'; end if;
  if s.acres + coalesce(p_acres, 0) < 1 then raise exception 'You need at least 1 acre to launch.'; end if;
  if p_acres > 0 then
    perform public._pay(v_me, null, p_acres * public.price('land_acre'), 'land', 'Bought ' || p_acres || ' acre(s)');
  end if;
  update public.stables set
    name = trim(p_name), location_city = nullif(trim(p_city), ''), location_region = nullif(trim(p_region), ''),
    location_country = nullif(trim(p_country), ''), terrain = nullif(trim(p_terrain), ''),
    acres = acres + coalesce(p_acres, 0), launched = true, launched_at = now()
  where id = s.id;
end $$;

create or replace function public.buy_land(p_acres int)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me();
begin
  if p_acres is null or p_acres < 1 or p_acres > 10000 then raise exception 'Buy between 1 and 10,000 acres.'; end if;
  perform public._pay(v_me, null, p_acres * public.price('land_acre'), 'land', 'Bought ' || p_acres || ' acre(s)');
  update public.stables set acres = acres + p_acres where owner_id = v_me;
end $$;

create or replace function public.sell_land(p_acres int)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); v_acres int; v_count int; v_refund bigint;
begin
  if p_acres is null or p_acres < 1 then raise exception 'Sell at least 1 acre.'; end if;
  select acres into v_acres from public.stables where owner_id = v_me for update;
  v_count := public._horses_on_property(v_me);
  if v_acres - p_acres < greatest(v_count, 1) then
    raise exception 'You need to keep at least % acre(s) for your herd.', greatest(v_count, 1);
  end if;
  v_refund := p_acres * public.price('land_acre') * public.price('land_sellback_pct') / 100;
  update public.stables set acres = acres - p_acres where owner_id = v_me;
  perform public._pay(null, v_me, v_refund, 'land_sale', 'Sold ' || p_acres || ' acre(s) back to the land office');
end $$;

create or replace function public.build_facility(
  p_kind text, p_name text, p_footing text, p_dimensions text, p_stalls int,
  p_features text[], p_description text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); s public.stables; t public.facility_types;
  v_cost bigint; v_feat text[]; v_id uuid; v_stalls int := coalesce(p_stalls, 0);
begin
  select * into s from public.stables where owner_id = v_me;
  if not s.launched then raise exception 'Launch your stable before you build.'; end if;
  select * into t from public.facility_types where kind = p_kind;
  if t.kind is null then raise exception 'Unknown facility type.'; end if;
  if not t.has_footing then p_footing := null; end if;
  if t.has_footing and p_footing is null then p_footing := 'native_dirt'; end if;
  if not t.has_stalls then v_stalls := 0; end if;
  select coalesce(array_agg(f.key), '{}') into v_feat
    from public.facility_features f where f.key = any(coalesce(p_features, '{}'));
  v_cost := t.base_price
    + coalesce((select price from public.footing_types where key = p_footing), 0)
    + v_stalls * public.price('stall')
    + coalesce(array_length(v_feat, 1), 0) * public.price('facility_feature');
  perform public._pay(v_me, null, v_cost, 'facility', 'Built: ' || coalesce(nullif(trim(p_name), ''), t.label));
  insert into public.facilities (stable_id, owner_id, kind, name, footing, dimensions, stalls, features, description, cost_paid)
  values (s.id, v_me, p_kind, coalesce(nullif(trim(p_name), ''), t.label), p_footing,
          coalesce(nullif(trim(p_dimensions), ''), t.default_dimensions), v_stalls, v_feat,
          nullif(trim(p_description), ''), v_cost)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.upgrade_facility(p_facility uuid, p_footing text, p_add_stalls int, p_add_features text[])
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); f public.facilities; t public.facility_types;
  v_cost bigint := 0; v_new_feat text[]; v_add_stalls int := greatest(coalesce(p_add_stalls, 0), 0);
begin
  select * into f from public.facilities where id = p_facility for update;
  if f.id is null or f.owner_id is distinct from v_me then raise exception 'That isn''t your facility.'; end if;
  select * into t from public.facility_types where kind = f.kind;
  if p_footing is not null and p_footing <> coalesce(f.footing, '') then
    if not t.has_footing then raise exception '% doesn''t use footing.', t.label; end if;
    v_cost := v_cost + (select price from public.footing_types where key = p_footing);
    if v_cost is null then raise exception 'Unknown footing.'; end if;
  else
    p_footing := f.footing;
  end if;
  if v_add_stalls > 0 and not t.has_stalls then raise exception '% doesn''t have stalls.', t.label; end if;
  v_cost := v_cost + v_add_stalls * public.price('stall');
  select coalesce(array_agg(x.key), '{}') into v_new_feat
    from public.facility_features x
   where x.key = any(coalesce(p_add_features, '{}')) and not (x.key = any(f.features));
  v_cost := v_cost + coalesce(array_length(v_new_feat, 1), 0) * public.price('facility_feature');
  if v_cost = 0 then raise exception 'Nothing to upgrade.'; end if;
  perform public._pay(v_me, null, v_cost, 'facility', 'Upgraded: ' || f.name);
  update public.facilities set footing = p_footing, stalls = stalls + v_add_stalls,
    features = features || v_new_feat, cost_paid = cost_paid + v_cost
  where id = f.id;
end $$;

-- Horses ------------------------------------------------------------------------

create or replace function public.create_horse(
  p_registered_name text, p_barn_name text, p_breed_id int, p_sex text, p_color text,
  p_markings text, p_height numeric, p_birth_date date, p_sire_name text, p_dam_name text,
  p_discipline text, p_personality text, p_blurb text, p_about text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); v_id uuid;
begin
  if not (select launched from public.stables where owner_id = v_me) then
    raise exception 'Launch your stable first. Horses need somewhere to live.';
  end if;
  if p_birth_date is null or p_birth_date > current_date then raise exception 'Pick a foaling date in the past.'; end if;
  if p_birth_date < current_date - interval '35 years' then raise exception 'Foundation horses can be at most 35 years old.'; end if;
  perform public._require_room(v_me, 1);
  perform public._pay(v_me, null, public.price('horse_creation'), 'horse_creation', 'Imported ' || trim(p_registered_name));
  insert into public.horses (
    owner_id, breeder_id, registered_name, barn_name, breed_id, sex, color, markings, height_hands,
    birth_date, sire_name, dam_name, discipline, personality, blurb, about, is_foundation,
    speed, stamina, agility, strength, intelligence, temperament, conformation
  ) values (
    v_me, null, trim(p_registered_name), nullif(trim(p_barn_name), ''), p_breed_id, p_sex, nullif(trim(p_color), ''),
    nullif(trim(p_markings), ''), p_height, p_birth_date, nullif(trim(p_sire_name), ''), nullif(trim(p_dam_name), ''),
    nullif(trim(p_discipline), ''), nullif(trim(p_personality), ''), nullif(trim(p_blurb), ''), nullif(trim(p_about), ''), true,
    public._rand_stat(30, 70), public._rand_stat(30, 70), public._rand_stat(30, 70), public._rand_stat(30, 70),
    public._rand_stat(30, 70), public._rand_stat(30, 70), public._rand_stat(30, 70)
  ) returning id into v_id;
  insert into public.horse_ownership (horse_id, from_id, to_id, price, how) values (v_id, null, v_me, null, 'created');
  return v_id;
end $$;

-- Why a horse can or can't breed on a given date (null = it can).
create or replace function public.breeding_block_reason(p_horse uuid, p_on date default current_date)
returns text language plpgsql stable security definer set search_path = public as $$
declare h public.horses; v_age int;
begin
  select * into h from public.horses where id = p_horse;
  if h.id is null then return 'Horse not found.'; end if;
  if h.sex = 'gelding' then return 'Geldings can''t breed.'; end if;
  if h.birth_date > p_on then return 'Wasn''t born yet on that date.'; end if;
  v_age := public.horse_age_on(h.birth_date, h.age_bonus_years, p_on);
  if v_age < 3 then return 'Too young (must be 3+).'; end if;
  if h.sex = 'mare' and v_age > 24 then return 'Too old (mares retire from breeding after 24).'; end if;
  if h.sex = 'stallion' and v_age > 30 then return 'Too old (stallions retire from breeding after 30).'; end if;
  if h.status = 'deceased' and p_on >= current_date - 30 then return 'Deceased.'; end if;
  return null;
end $$;

create or replace function public.register_foal(
  p_dam uuid, p_sire uuid, p_birth_date date, p_registered_name text, p_barn_name text,
  p_sex text, p_breed_id int, p_color text, p_markings text, p_keep boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); d public.horses; s public.horses; v_reason text;
  v_id uuid; v_sex text := p_sex; v_breed public.breeds; v_date date := coalesce(p_birth_date, current_date);
  v_keep boolean := coalesce(p_keep, true);
begin
  select * into d from public.horses where id = p_dam;
  select * into s from public.horses where id = p_sire;
  if d.id is null or d.sex <> 'mare' then raise exception 'Pick one of your mares as the dam.'; end if;
  if d.owner_id is distinct from v_me then raise exception 'You can only register foals out of mares you own.'; end if;
  if s.id is null or s.sex <> 'stallion' then raise exception 'The sire has to be a stallion.'; end if;
  if s.owner_id is distinct from v_me and not s.at_stud then
    raise exception '% isn''t standing at stud. Ask the owner to list him.', s.registered_name;
  end if;
  if v_date > current_date then raise exception 'Foaling date can''t be in the future.'; end if;
  if v_date < current_date - interval '35 years' then raise exception 'That''s too far back.'; end if;

  v_reason := public.breeding_block_reason(d.id, v_date);
  if v_reason is not null then raise exception 'Dam: %', v_reason; end if;
  v_reason := public.breeding_block_reason(s.id, v_date);
  if v_reason is not null then raise exception 'Sire: %', v_reason; end if;

  if exists (select 1 from public.horses where dam_id = d.id and abs(birth_date - v_date) < 330) then
    raise exception '% already has a foal within 11 months of that date. One foal per year, mama needs a break.', d.registered_name;
  end if;

  select * into v_breed from public.breeds where id = p_breed_id;
  if v_breed.id is null then raise exception 'Pick a breed.'; end if;
  if v_breed.id not in (d.breed_id, s.breed_id) and not v_breed.is_grade then
    raise exception 'A foal can be registered as the sire''s breed, the dam''s breed, or Grade / Crossbred.';
  end if;

  if v_sex is null or v_sex = 'random' then
    v_sex := case when random() < 0.5 then 'mare' else 'stallion' end;
  end if;
  if v_sex not in ('mare', 'stallion', 'gelding') then raise exception 'Invalid sex.'; end if;

  if v_keep then perform public._require_room(v_me, 1); end if;

  if s.owner_id is distinct from v_me and coalesce(s.stud_fee, 0) > 0 then
    perform public._pay(v_me, s.owner_id, s.stud_fee, 'stud_fee', 'Stud fee: ' || s.registered_name || ' x ' || d.registered_name, s.id);
  end if;
  perform public._pay(v_me, null, public.price('foal_registration'), 'foal_registration', 'Registered ' || trim(p_registered_name));

  insert into public.horses (
    owner_id, breeder_id, registered_name, barn_name, breed_id, sex, color, markings, birth_date,
    sire_id, dam_id, status,
    speed, stamina, agility, strength, intelligence, temperament, conformation
  ) values (
    v_me, v_me, trim(p_registered_name), nullif(trim(p_barn_name), ''), v_breed.id, v_sex,
    nullif(trim(p_color), ''), nullif(trim(p_markings), ''), v_date, s.id, d.id,
    case when v_keep then 'active' else 'record' end,
    public._clamp((d.speed + s.speed) / 2 + public._rand_stat(-8, 10)),
    public._clamp((d.stamina + s.stamina) / 2 + public._rand_stat(-8, 10)),
    public._clamp((d.agility + s.agility) / 2 + public._rand_stat(-8, 10)),
    public._clamp((d.strength + s.strength) / 2 + public._rand_stat(-8, 10)),
    public._clamp((d.intelligence + s.intelligence) / 2 + public._rand_stat(-8, 10)),
    public._clamp((d.temperament + s.temperament) / 2 + public._rand_stat(-8, 10)),
    public._clamp((d.conformation + s.conformation) / 2 + public._rand_stat(-8, 10))
  ) returning id into v_id;
  insert into public.horse_ownership (horse_id, from_id, to_id, how) values (v_id, null, v_me, 'foaled');
  return v_id;
end $$;

create or replace function public.age_up_foal(p_horse uuid, p_use_credit boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); h public.horses;
begin
  select * into h from public.horses where id = p_horse for update;
  if h.id is null or h.owner_id is distinct from v_me then raise exception 'That isn''t your horse.'; end if;
  if h.age_bonus_years > 0 then raise exception '% has already been aged up.', h.registered_name; end if;
  if public.horse_age_on(h.birth_date, 0, current_date) <> 0 then
    raise exception 'Only 0-year-old foals can be aged up.';
  end if;
  if coalesce(p_use_credit, false) then
    update public.bank_accounts set age_credits = age_credits - 1 where profile_id = v_me and age_credits > 0;
    if not found then raise exception 'You''re out of age-up credits.'; end if;
  else
    perform public._pay(v_me, null, public.price('age_up'), 'age_up', 'Aged up ' || h.registered_name, h.id);
  end if;
  update public.horses set age_bonus_years = 3 where id = h.id;
end $$;

create or replace function public.set_horse_status(p_horse uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); h public.horses;
begin
  select * into h from public.horses where id = p_horse for update;
  if h.id is null or h.owner_id is distinct from v_me then raise exception 'That isn''t your horse.'; end if;
  if p_status not in ('active', 'retired', 'deceased', 'record') then raise exception 'Invalid status.'; end if;
  if h.status = 'deceased' then raise exception 'Rest easy. Deceased horses stay that way.'; end if;
  if p_status in ('active', 'retired') and h.status not in ('active', 'retired') then
    perform public._require_room(v_me, 1);
  end if;
  update public.horses set status = p_status,
    for_sale = case when p_status = 'deceased' then false else for_sale end,
    at_stud = case when p_status in ('deceased', 'record') then false else at_stud end
  where id = h.id;
end $$;

create or replace function public.geld_horse(p_horse uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); h public.horses;
begin
  select * into h from public.horses where id = p_horse for update;
  if h.id is null or h.owner_id is distinct from v_me then raise exception 'That isn''t your horse.'; end if;
  if h.sex <> 'stallion' then raise exception 'Only stallions can be gelded.'; end if;
  update public.horses set sex = 'gelding', at_stud = false where id = h.id;
end $$;

create or replace function public._move_horse(p_horse uuid, p_from uuid, p_to uuid, p_price bigint, p_how text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_room(p_to, 1);
  if coalesce(p_price, 0) > 0 then
    perform public._pay(p_to, p_from, p_price, 'horse_' || p_how,
      (select registered_name from public.horses where id = p_horse), p_horse);
  end if;
  update public.horses set owner_id = p_to, for_sale = false, sale_price = null, at_stud = false,
    status = case when status = 'record' then 'active' else status end
  where id = p_horse;
  update public.transfer_offers set status = 'cancelled', resolved_at = now()
   where horse_id = p_horse and status = 'pending';
  insert into public.horse_ownership (horse_id, from_id, to_id, price, how)
  values (p_horse, p_from, p_to, nullif(p_price, 0), p_how);
end $$;

create or replace function public.buy_horse(p_horse uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); h public.horses;
begin
  select * into h from public.horses where id = p_horse for update;
  if h.id is null or not h.for_sale then raise exception 'That horse isn''t for sale.'; end if;
  if h.owner_id = v_me then raise exception 'You already own this horse. Congrats?'; end if;
  if h.status = 'deceased' then raise exception 'That horse is deceased.'; end if;
  perform public._move_horse(h.id, h.owner_id, v_me, h.sale_price, 'sale');
end $$;

create or replace function public.offer_horse(p_horse uuid, p_to_username text, p_price bigint, p_note text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); v_to uuid := public._profile_by_username(p_to_username); h public.horses; v_id bigint;
begin
  select * into h from public.horses where id = p_horse;
  if h.id is null or h.owner_id is distinct from v_me then raise exception 'That isn''t your horse.'; end if;
  if h.status = 'deceased' then raise exception 'That horse is deceased.'; end if;
  if v_to = v_me then raise exception 'You already own this horse.'; end if;
  if coalesce(p_price, 0) < 0 then raise exception 'Price can''t be negative.'; end if;
  insert into public.transfer_offers (horse_id, from_id, to_id, price, note)
  values (h.id, v_me, v_to, coalesce(p_price, 0), nullif(trim(p_note), '')) returning id into v_id;
  return v_id;
end $$;

create or replace function public.respond_offer(p_offer bigint, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); o public.transfer_offers; h public.horses;
begin
  select * into o from public.transfer_offers where id = p_offer for update;
  if o.id is null or o.status <> 'pending' then raise exception 'That offer is no longer open.'; end if;
  if v_me = o.from_id and not p_accept then
    update public.transfer_offers set status = 'cancelled', resolved_at = now() where id = o.id; return;
  end if;
  if v_me <> o.to_id then raise exception 'That offer isn''t addressed to you.'; end if;
  if not p_accept then
    update public.transfer_offers set status = 'declined', resolved_at = now() where id = o.id; return;
  end if;
  select * into h from public.horses where id = o.horse_id for update;
  if h.owner_id is distinct from o.from_id then raise exception 'The horse changed hands since this offer was made.'; end if;
  perform public._move_horse(h.id, o.from_id, v_me, o.price, 'transfer');
  update public.transfer_offers set status = 'accepted', resolved_at = now() where id = o.id;
end $$;

-- Shops --------------------------------------------------------------------------

create or replace function public.open_shop(p_name text, p_description text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); v_id uuid;
begin
  if (select count(*) from public.shops where owner_id = v_me) >= 3 then raise exception 'Three shops max per player.'; end if;
  perform public._pay(v_me, null, public.price('shop_license'), 'shop_license', 'Shop license: ' || trim(p_name));
  insert into public.shops (owner_id, name, description) values (v_me, trim(p_name), nullif(trim(p_description), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.buy_item(p_item uuid, p_qty int)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); i public.shop_items; sh public.shops; v_total bigint; v_qty int := coalesce(p_qty, 1);
begin
  if v_qty < 1 or v_qty > 999 then raise exception 'Quantity must be 1–999.'; end if;
  select * into i from public.shop_items where id = p_item for update;
  if i.id is null or not i.active then raise exception 'That item isn''t available.'; end if;
  select * into sh from public.shops where id = i.shop_id;
  if not sh.is_open then raise exception 'That shop is closed.'; end if;
  if sh.owner_id = v_me then raise exception 'You can''t buy from your own shop.'; end if;
  if i.stock is not null and i.stock < v_qty then raise exception 'Only % left in stock.', i.stock; end if;
  v_total := i.price * v_qty;
  perform public._pay(v_me, sh.owner_id, v_total, 'shop_purchase', v_qty || ' x ' || i.name || ' from ' || sh.name);
  if i.stock is not null then update public.shop_items set stock = stock - v_qty where id = i.id; end if;
  if i.special = 'age_credit' then
    update public.bank_accounts set age_credits = age_credits + v_qty where profile_id = v_me;
  else
    update public.inventory set quantity = quantity + v_qty where owner_id = v_me and item_id = i.id;
    if not found then
      insert into public.inventory (owner_id, item_id, name, description, image_url, quantity)
      values (v_me, i.id, i.name, i.description, i.image_url, v_qty);
    end if;
  end if;
  insert into public.shop_orders (item_id, shop_id, buyer_id, seller_id, item_name, quantity, total)
  values (i.id, sh.id, v_me, sh.owner_id, i.name, v_qty, v_total);
end $$;

-- Associations -------------------------------------------------------------------

create or replace function public.found_association(p_name text, p_abbr text, p_kind text, p_description text, p_rules text, p_fee bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); v_slug text; v_id uuid;
begin
  if p_kind not in ('breed', 'discipline', 'club') then raise exception 'Invalid association type.'; end if;
  v_slug := left(trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(p_abbr), ''), p_name)), '[^a-z0-9]+', '-', 'g')), 40);
  if char_length(v_slug) < 2 then raise exception 'Give it a longer name or abbreviation.'; end if;
  if exists (select 1 from public.associations where slug = v_slug) then
    v_slug := left(v_slug, 35) || '-' || substr(md5(random()::text), 1, 4);
  end if;
  perform public._pay(v_me, null, public.price('association_charter'), 'association_charter', 'Chartered ' || trim(p_name));
  insert into public.associations (slug, name, abbreviation, kind, description, rules, founder_id, membership_fee)
  values (v_slug, trim(p_name), nullif(trim(p_abbr), ''), p_kind, nullif(trim(p_description), ''), nullif(trim(p_rules), ''), v_me, greatest(coalesce(p_fee, 0), 0))
  returning id into v_id;
  insert into public.association_members (association_id, profile_id, role) values (v_id, v_me, 'president');
  return v_slug;
end $$;

create or replace function public.join_association(p_association uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); a public.associations;
begin
  select * into a from public.associations where id = p_association;
  if a.id is null then raise exception 'Association not found.'; end if;
  if exists (select 1 from public.association_members where association_id = a.id and profile_id = v_me) then
    raise exception 'You''re already a member.';
  end if;
  if a.membership_fee > 0 then
    perform public._pay(v_me, a.founder_id, a.membership_fee, 'association_dues', 'Membership: ' || a.name);
  end if;
  insert into public.association_members (association_id, profile_id) values (a.id, v_me);
end $$;

-- Forum ----------------------------------------------------------------------------

create or replace function public.create_thread(
  p_category int, p_title text, p_body text, p_kind text, p_horse uuid,
  p_show_date date, p_show_classes text[], p_entry_fee bigint
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); c public.forum_categories; v_id bigint; v_kind text := coalesce(p_kind, 'discussion');
  v_classes text[];
begin
  select * into c from public.forum_categories where id = p_category;
  if c.id is null then raise exception 'Pick a forum.'; end if;
  if c.admin_only and not coalesce((select is_admin from public.profiles where id = v_me), false) then
    raise exception 'Only staff can start threads in %.', c.name;
  end if;
  if v_kind not in ('discussion', 'sale', 'stud', 'show') then v_kind := 'discussion'; end if;
  if p_horse is not null and not exists (select 1 from public.horses where id = p_horse and owner_id = v_me) then
    raise exception 'You can only feature horses you own.';
  end if;
  select coalesce(array_agg(distinct trim(x)), '{}') into v_classes
    from unnest(coalesce(p_show_classes, '{}')) x where trim(x) <> '';
  if v_kind = 'show' and coalesce(array_length(v_classes, 1), 0) = 0 then
    raise exception 'A show needs at least one class.';
  end if;
  insert into public.forum_threads (category_id, author_id, title, kind, horse_id, show_date, show_classes, entry_fee,
    show_status, post_count, last_post_at, last_post_by)
  values (c.id, v_me, trim(p_title), v_kind, p_horse, p_show_date, v_classes, greatest(coalesce(p_entry_fee, 0), 0),
    case when v_kind = 'show' then 'open' end, 0, now(), v_me)
  returning id into v_id;
  insert into public.forum_posts (thread_id, author_id, body) values (v_id, v_me, p_body);
  return v_id;
end $$;

create or replace function public.on_forum_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.forum_threads
     set post_count = post_count + 1, last_post_at = new.created_at, last_post_by = new.author_id
   where id = new.thread_id;
  return new;
end $$;
create trigger forum_post_counter after insert on public.forum_posts
  for each row execute function public.on_forum_post();

create or replace function public.enter_show(p_thread bigint, p_horse uuid, p_class text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me(); t public.forum_threads; h public.horses; v_age int;
begin
  select * into t from public.forum_threads where id = p_thread;
  if t.id is null or t.kind <> 'show' then raise exception 'That thread isn''t a show.'; end if;
  if t.show_status <> 'open' then raise exception 'Entries are closed.'; end if;
  if not (p_class = any(t.show_classes)) then raise exception 'Pick a class from the show bill.'; end if;
  select * into h from public.horses where id = p_horse;
  if h.id is null or h.owner_id is distinct from v_me then raise exception 'You can only enter horses you own.'; end if;
  if h.status <> 'active' then raise exception 'Only active horses can show.'; end if;
  v_age := public.horse_age_on(h.birth_date, h.age_bonus_years, current_date);
  if v_age < 3 then raise exception '% is too young to show (3+). Age-up credits exist for a reason.', h.registered_name; end if;
  if t.entry_fee > 0 and t.author_id <> v_me then
    perform public._pay(v_me, t.author_id, t.entry_fee, 'show_entry', 'Entry: ' || h.registered_name || ' in ' || p_class, h.id);
  end if;
  insert into public.show_entries (thread_id, horse_id, entrant_id, class_name) values (t.id, h.id, v_me, p_class);
end $$;

create or replace function public.set_show_status(p_thread bigint, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me();
begin
  if p_status not in ('open', 'closed', 'results') then raise exception 'Invalid status.'; end if;
  update public.forum_threads set show_status = p_status where id = p_thread and author_id = v_me and kind = 'show';
  if not found then raise exception 'Only the host can do that.'; end if;
end $$;

create or replace function public.set_placing(p_entry bigint, p_placing int)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me();
begin
  update public.show_entries e set place = p_placing
    from public.forum_threads t
   where e.id = p_entry and t.id = e.thread_id and t.author_id = v_me;
  if not found then raise exception 'Only the host can place entries.'; end if;
end $$;

create or replace function public.moderate_thread(p_thread bigint, p_pinned boolean, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._me();
begin
  if not coalesce((select is_admin from public.profiles where id = v_me), false) then
    raise exception 'Staff only.';
  end if;
  update public.forum_threads set pinned = coalesce(p_pinned, pinned), locked = coalesce(p_locked, locked) where id = p_thread;
end $$;

