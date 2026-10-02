-- Cavaletti core schema
-- Everything that moves money, horses, or land goes through SECURITY DEFINER
-- functions so the rules (acreage, breeding ages, balances) can't be skipped
-- by poking the REST API directly. Players only get direct UPDATE on the
-- cosmetic columns they're allowed to edit.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Catalogs & prices
-- ---------------------------------------------------------------------------

create table public.price_list (
  key text primary key,
  label text not null,
  amount bigint not null check (amount >= 0),
  description text,
  sort int not null default 0
);

insert into public.price_list (key, label, amount, description, sort) values
  ('starting_balance', 'Starting bank balance', 50000, 'Deposited when a new account opens.', 0),
  ('land_acre', 'Land (per acre)', 2000, 'You need at least one acre per horse on the property.', 1),
  ('land_sellback_pct', 'Land buy-back (% of price)', 50, 'What the land office pays when you sell acreage back.', 2),
  ('horse_creation', 'Foundation horse import', 2500, 'Bring a brand-new foundation horse into the game.', 3),
  ('foal_registration', 'Foal registration', 250, 'Charged every time a foal is registered, live or retroactive.', 4),
  ('age_up', 'Age-up (+3 years)', 7500, 'Fast-forward a 0-year-old foal three years so it can show. Or use an age-up credit.', 5),
  ('age_credit', 'Age-up credit', 7500, 'One credit = one free age-up.', 6),
  ('shop_license', 'Player shop license', 1000, 'Open your own shop on the main site.', 7),
  ('association_charter', 'Association charter', 1500, 'Found a player-run association or club.', 8),
  ('stall', 'Barn stall (each)', 750, 'Added to barns and shedrows.', 9),
  ('facility_feature', 'Facility add-on (each)', 500, 'Lights, mirrors, viewing deck, etc.', 10);

create table public.facility_types (
  kind text primary key,
  label text not null,
  base_price bigint not null check (base_price >= 0),
  has_footing boolean not null default false,
  has_stalls boolean not null default false,
  default_dimensions text,
  description text,
  sort int not null default 0
);

insert into public.facility_types (kind, label, base_price, has_footing, has_stalls, default_dimensions, description, sort) values
  ('barn', 'Barn', 12000, false, true, '36'' x 120''', 'Center-aisle barn. Add as many stalls as you can afford.', 1),
  ('shedrow', 'Shedrow / Run-in', 4000, false, true, '24'' x 60''', 'Open-front stalls for easy keepers.', 2),
  ('round_pen', 'Round Pen', 1500, true, false, '60'' diameter', 'For lunging, starting youngsters, and liberty work.', 3),
  ('corral', 'Corral', 1000, true, false, '50'' x 50''', 'Small fenced pen for turnout and holding.', 4),
  ('paddock', 'Paddock', 800, false, false, '1/2 acre', 'Grass or dry-lot turnout.', 5),
  ('pasture', 'Pasture', 1200, false, false, '5 acres', 'Big fenced grazing for the herd.', 6),
  ('outdoor_arena', 'Outdoor Arena', 8000, true, false, '100'' x 200''', 'All-purpose riding arena.', 7),
  ('indoor_arena', 'Indoor Arena', 25000, true, false, '80'' x 200''', 'Ride rain or shine.', 8),
  ('dressage_arena', 'Dressage Arena', 10000, true, false, '20m x 60m', 'Lettered court for flatwork.', 9),
  ('jump_field', 'Jump Field / Grand Prix Ring', 9000, true, false, '150'' x 250''', 'Show jumping ring with a course of fences.', 10),
  ('xc_course', 'Cross-Country Course', 14000, true, false, '24 fences', 'Banks, ditches, water, and logs.', 11),
  ('reining_pen', 'Reining / Cutting Pen', 9000, true, false, '100'' x 200''', 'Deep, groomed footing for slides and spins.', 12),
  ('training_track', 'Training Track', 20000, true, false, '5/8 mile oval', 'Gallop track for racehorses and conditioning.', 13),
  ('hot_walker', 'Hot Walker', 3000, false, false, '4-arm', 'Cooling out made easy.', 14),
  ('wash_rack', 'Wash Rack', 1500, false, false, '2 bays', 'Hot and cold water, rubber mats.', 15),
  ('tack_room', 'Tack Room', 2000, false, false, '12'' x 16''', 'Saddle racks, bridle hooks, a fridge for the important stuff.', 16),
  ('hay_barn', 'Hay Barn', 5000, false, false, '2,000 bale capacity', 'Keep the good stuff dry.', 17),
  ('breeding_shed', 'Breeding Shed & Lab', 7000, true, false, '40'' x 60''', 'Phantom mare, lab, and recovery stalls.', 18),
  ('foaling_barn', 'Foaling Barn', 9000, false, true, 'camera-monitored', 'Oversized foaling stalls with cameras.', 19),
  ('trail_system', 'Trail System', 1000, false, false, '3 miles', 'Wooded trails for brain breaks.', 20),
  ('vet_clinic', 'On-site Vet Clinic', 18000, false, true, 'exam room + stocks', 'Treatment stalls and an exam room.', 21),
  ('lodging', 'Rider Lodging / Clubhouse', 15000, false, false, '4 rooms', 'For clinics, working students, and post-show debriefs.', 22);

create table public.footing_types (
  key text primary key,
  label text not null,
  price bigint not null check (price >= 0),
  description text,
  sort int not null default 0
);

insert into public.footing_types (key, label, price, description, sort) values
  ('native_dirt', 'Native Dirt', 0, 'Whatever was here first. Free. Dusty.', 1),
  ('grass', 'Grass', 500, 'Classic, but it gets slick when wet.', 2),
  ('sand', 'Washed Sand', 1500, 'Reliable all-rounder.', 3),
  ('stone_dust', 'Stone Dust', 2000, 'Firm, drains well.', 4),
  ('clay_blend', 'Clay Blend', 2500, 'Traditional reining and cutting base.', 5),
  ('rubber_crumb', 'Sand + Rubber Crumb', 4000, 'Springy and easier on joints.', 6),
  ('fiber_sand', 'Fiber Sand', 6000, 'Sand stabilized with textile fibers.', 7),
  ('wax_coated', 'Wax-Coated Sand', 9000, 'Dust-free, consistent, very fancy.', 8),
  ('geotextile', 'Geotextile (GGT)', 11000, 'Top-tier show footing. Your farrier sends a thank-you card.', 9),
  ('turf_track', 'Turf (Track)', 7000, 'Racing turf for galloping tracks.', 10),
  ('synthetic_track', 'Synthetic (Track)', 12000, 'All-weather racing surface.', 11);

create table public.facility_features (
  key text primary key,
  label text not null,
  sort int not null default 0
);

insert into public.facility_features (key, label, sort) values
  ('lights', 'Arena lights', 1),
  ('mirrors', 'Mirrors', 2),
  ('viewing_deck', 'Viewing deck', 3),
  ('sprinklers', 'Dust sprinklers', 4),
  ('heated', 'Heated', 5),
  ('fans', 'Big fans', 6),
  ('auto_waterers', 'Automatic waterers', 7),
  ('fly_system', 'Fly spray system', 8),
  ('rubber_mats', 'Rubber mats', 9),
  ('cameras', 'Cameras', 10),
  ('sound_system', 'Sound system', 11),
  ('jump_course', 'Full jump course', 12),
  ('cattle_pens', 'Cattle pens', 13),
  ('kitchen', 'Kitchenette', 14),
  ('wifi', 'Barn Wi-Fi', 15);

-- ---------------------------------------------------------------------------
-- People, money
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  bio text check (char_length(bio) <= 4000),
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower on public.profiles (lower(username));

-- Kept apart from profiles so balances stay private while profiles are public.
create table public.bank_accounts (
  profile_id uuid primary key references public.profiles on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  age_credits int not null default 1 check (age_credits >= 0),
  updated_at timestamptz not null default now()
);

-- One row per balance change on one account (a transfer writes two).
create table public.ledger (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.profiles on delete cascade,
  delta bigint not null,
  balance_after bigint not null,
  kind text not null,
  memo text,
  counterparty_id uuid references public.profiles on delete set null,
  horse_id uuid,
  created_at timestamptz not null default now()
);
create index ledger_account on public.ledger (account_id, created_at desc);

create table public.checks (
  id bigint generated always as identity primary key,
  check_number int not null,
  writer_id uuid not null references public.profiles on delete cascade,
  payee_id uuid not null references public.profiles on delete cascade,
  amount bigint not null check (amount > 0),
  memo text check (char_length(memo) <= 200),
  status text not null default 'pending' check (status in ('pending', 'deposited', 'voided')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Stables, land, facilities
-- ---------------------------------------------------------------------------

create table public.stables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles on delete cascade,
  name text check (char_length(name) <= 80),
  tagline text check (char_length(tagline) <= 160),
  description text check (char_length(description) <= 8000),
  location_city text check (char_length(location_city) <= 80),
  location_region text check (char_length(location_region) <= 80),
  location_country text check (char_length(location_country) <= 80),
  terrain text check (char_length(terrain) <= 80),
  specialties text check (char_length(specialties) <= 200),
  banner_url text,
  acres int not null default 0 check (acres >= 0),
  launched boolean not null default false,
  launched_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  stable_id uuid not null references public.stables on delete cascade,
  owner_id uuid not null references public.profiles on delete cascade,
  kind text not null references public.facility_types,
  name text not null check (char_length(name) between 1 and 80),
  footing text references public.footing_types,
  dimensions text check (char_length(dimensions) <= 60),
  stalls int not null default 0 check (stalls >= 0 and stalls <= 200),
  features text[] not null default '{}',
  description text check (char_length(description) <= 2000),
  cost_paid bigint not null default 0,
  created_at timestamptz not null default now()
);
create index facilities_stable on public.facilities (stable_id);

-- ---------------------------------------------------------------------------
-- Associations & breeds
-- ---------------------------------------------------------------------------

create table public.associations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 3 and 100),
  abbreviation text check (char_length(abbreviation) <= 12),
  kind text not null default 'club' check (kind in ('breed', 'discipline', 'club')),
  description text check (char_length(description) <= 8000),
  rules text check (char_length(rules) <= 8000),
  logo_url text,
  official boolean not null default false,
  founder_id uuid references public.profiles on delete set null,
  membership_fee bigint not null default 0 check (membership_fee >= 0),
  created_at timestamptz not null default now()
);

create table public.association_members (
  association_id uuid not null references public.associations on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('president', 'officer', 'member')),
  joined_at timestamptz not null default now(),
  primary key (association_id, profile_id)
);

create table public.breeds (
  id serial primary key,
  name text not null unique,
  association_id uuid references public.associations on delete set null,
  origin text,
  typical_height text,
  description text,
  is_grade boolean not null default false
);

-- Fictional "in-world" registries. Deliberately not the real-world orgs.
insert into public.associations (slug, name, abbreviation, kind, official, description, rules) values
  ('cqha', 'Cavaletti Quarter Horse Association', 'CQHA', 'breed', true, 'The registry for stock-type Quarter Horses in Cavaletti. Ranch, reining, cutting, barrels, pleasure.', 'Foals of two registered CQHA parents are eligible. Appendix registrations (QH x TB) accepted.'),
  ('cjc', 'Cavaletti Jockey Club', 'CJC', 'breed', true, 'Thoroughbred registry and racing authority.', 'Both parents must be registered Thoroughbreds. Live cover only — no exceptions, we checked.'),
  ('caha', 'Cavaletti Arabian Horse Association', 'CAHA', 'breed', true, 'Purebred and Half-Arabian registry.', 'Purebreds require two registered Arabian parents. Half-Arabians welcome.'),
  ('csa', 'Cavaletti Sporthorse Alliance', 'CSA', 'breed', true, 'Warmblood and sporthorse studbook for hunters, jumpers, eventers, and dressage horses.', 'Open studbook. Approved stallions earn a premium badge.'),
  ('cpha', 'Cavaletti Paint & Pinto Association', 'CPHA', 'breed', true, 'Color-breed registry for Paints and Pintos.', 'Stock-type parents with qualifying color.'),
  ('cac', 'Cavaletti Appaloosa Club', 'CAC', 'breed', true, 'Spots, stripes, and sass.', 'At least one Appaloosa parent.'),
  ('cbr', 'Cavaletti Baroque Registry', 'CBR', 'breed', true, 'Friesians, Andalusians, Lusitanos — the flowing-mane crowd.', 'Purebred registrations only.'),
  ('cmhs', 'Cavaletti Morgan & Heritage Society', 'CMHS', 'breed', true, 'Morgans, Mustangs, and American heritage breeds.', 'Mustangs may be registered from foundation stock.'),
  ('cshow', 'Cavaletti Show Circuit', 'CSC', 'discipline', true, 'The official all-breed show circuit. Player-hosted shows can apply for circuit points.', 'Hosts post results within 7 days of the show closing.');

insert into public.breeds (name, association_id, origin, typical_height, description, is_grade) values
  ('American Quarter Horse', (select id from public.associations where slug = 'cqha'), 'United States', '14.2 – 16 hh', 'Fast over a quarter mile, cowy, sensible.', false),
  ('Appendix Quarter Horse', (select id from public.associations where slug = 'cqha'), 'United States', '15 – 16.2 hh', 'Quarter Horse x Thoroughbred.', false),
  ('Thoroughbred', (select id from public.associations where slug = 'cjc'), 'England', '15.2 – 17 hh', 'Racing royalty with opinions.', false),
  ('Arabian', (select id from public.associations where slug = 'caha'), 'Arabian Peninsula', '14.1 – 15.1 hh', 'Endurance, beauty, and dramatic flair.', false),
  ('Half-Arabian', (select id from public.associations where slug = 'caha'), 'Various', '14.2 – 16 hh', 'Arabian blood plus something else.', false),
  ('Hanoverian', (select id from public.associations where slug = 'csa'), 'Germany', '15.3 – 17.2 hh', 'Warmblood built for dressage and jumping.', false),
  ('Dutch Warmblood', (select id from public.associations where slug = 'csa'), 'Netherlands', '16 – 17.2 hh', 'Modern sporthorse.', false),
  ('Holsteiner', (select id from public.associations where slug = 'csa'), 'Germany', '16 – 17 hh', 'Scopey jumpers.', false),
  ('Irish Sport Horse', (select id from public.associations where slug = 'csa'), 'Ireland', '15.2 – 17 hh', 'Bold eventers.', false),
  ('American Paint Horse', (select id from public.associations where slug = 'cpha'), 'United States', '14.2 – 16 hh', 'Stock horse with a paint job.', false),
  ('Pinto', (select id from public.associations where slug = 'cpha'), 'Various', 'varies', 'Color first, breed second.', false),
  ('Appaloosa', (select id from public.associations where slug = 'cac'), 'United States', '14.2 – 16 hh', 'Spotted, hardy, and stubborn in a fun way.', false),
  ('Friesian', (select id from public.associations where slug = 'cbr'), 'Netherlands', '15 – 17 hh', 'Black, feathered, majestic.', false),
  ('Andalusian', (select id from public.associations where slug = 'cbr'), 'Spain', '15 – 16.2 hh', 'Classical dressage legend.', false),
  ('Lusitano', (select id from public.associations where slug = 'cbr'), 'Portugal', '15 – 16 hh', 'Brave, collected, gorgeous.', false),
  ('Morgan', (select id from public.associations where slug = 'cmhs'), 'United States', '14.1 – 15.2 hh', 'One horse, every job.', false),
  ('Mustang', (select id from public.associations where slug = 'cmhs'), 'United States', '13 – 15 hh', 'Wild-born grit.', false),
  ('Tennessee Walking Horse', (select id from public.associations where slug = 'cmhs'), 'United States', '15 – 17 hh', 'Smooth gaits, long days.', false),
  ('Welsh Pony', null, 'Wales', '11 – 14.2 hh', 'Small, smart, sassy.', false),
  ('Connemara', null, 'Ireland', '13 – 15 hh', 'Pony-sized athlete.', false),
  ('Shetland Pony', null, 'Scotland', 'under 11 hh', 'Tiny tyrant.', false),
  ('Clydesdale', null, 'Scotland', '16 – 18 hh', 'Big feathers, bigger heart.', false),
  ('Percheron', null, 'France', '15 – 19 hh', 'Draft power.', false),
  ('Grade / Crossbred', null, 'Anywhere', 'varies', 'Unregistered or mixed breeding. Some of the best horses ever.', true);

-- ---------------------------------------------------------------------------
-- Horses
-- ---------------------------------------------------------------------------

create table public.horses (
  id uuid primary key default gen_random_uuid(),
  reg_number bigint generated always as identity unique,
  owner_id uuid references public.profiles on delete set null,
  breeder_id uuid references public.profiles on delete set null,
  registered_name text not null check (char_length(registered_name) between 2 and 60),
  barn_name text check (char_length(barn_name) <= 40),
  breed_id int not null references public.breeds,
  sex text not null check (sex in ('mare', 'stallion', 'gelding')),
  color text check (char_length(color) <= 60),
  markings text check (char_length(markings) <= 200),
  height_hands numeric(3,1) check (height_hands between 6 and 20),
  birth_date date not null,
  age_bonus_years int not null default 0 check (age_bonus_years between 0 and 3),
  sire_id uuid references public.horses on delete set null,
  dam_id uuid references public.horses on delete set null,
  sire_name text check (char_length(sire_name) <= 60),
  dam_name text check (char_length(dam_name) <= 60),
  discipline text check (char_length(discipline) <= 80),
  personality text check (char_length(personality) <= 120),
  blurb text check (char_length(blurb) <= 300),
  about text check (char_length(about) <= 8000),
  image_url text,
  speed int not null default 50 check (speed between 1 and 100),
  stamina int not null default 50 check (stamina between 1 and 100),
  agility int not null default 50 check (agility between 1 and 100),
  strength int not null default 50 check (strength between 1 and 100),
  intelligence int not null default 50 check (intelligence between 1 and 100),
  temperament int not null default 50 check (temperament between 1 and 100),
  conformation int not null default 50 check (conformation between 1 and 100),
  status text not null default 'active' check (status in ('active', 'retired', 'deceased', 'record')),
  for_sale boolean not null default false,
  sale_price bigint check (sale_price is null or sale_price >= 0),
  at_stud boolean not null default false,
  stud_fee bigint check (stud_fee is null or stud_fee >= 0),
  is_foundation boolean not null default false,
  created_at timestamptz not null default now(),
  constraint stud_only_stallions check (not at_stud or sex = 'stallion'),
  constraint sale_needs_price check (not for_sale or sale_price is not null),
  constraint stud_needs_fee check (not at_stud or stud_fee is not null)
);
create index horses_owner on public.horses (owner_id);
create index horses_sire on public.horses (sire_id);
create index horses_dam on public.horses (dam_id);
create index horses_market on public.horses (for_sale) where for_sale;
create index horses_stud on public.horses (at_stud) where at_stud;

create table public.horse_ownership (
  id bigint generated always as identity primary key,
  horse_id uuid not null references public.horses on delete cascade,
  from_id uuid references public.profiles on delete set null,
  to_id uuid references public.profiles on delete set null,
  price bigint,
  how text not null, -- created | foaled | sale | transfer
  created_at timestamptz not null default now()
);
create index horse_ownership_horse on public.horse_ownership (horse_id, created_at);

create table public.transfer_offers (
  id bigint generated always as identity primary key,
  horse_id uuid not null references public.horses on delete cascade,
  from_id uuid not null references public.profiles on delete cascade,
  to_id uuid not null references public.profiles on delete cascade,
  price bigint not null default 0 check (price >= 0),
  note text check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Shops
-- ---------------------------------------------------------------------------

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles on delete cascade, -- null = Cavaletti General Store
  name text not null check (char_length(name) between 3 and 80),
  description text check (char_length(description) <= 4000),
  banner_url text,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.shop_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 1000),
  category text check (char_length(category) <= 40),
  image_url text,
  price bigint not null check (price >= 0),
  stock int check (stock is null or stock >= 0), -- null = unlimited
  special text check (special in ('age_credit')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  item_id uuid references public.shop_items on delete set null,
  name text not null,
  description text,
  image_url text,
  quantity int not null default 1 check (quantity >= 0),
  acquired_at timestamptz not null default now()
);

create table public.shop_orders (
  id bigint generated always as identity primary key,
  item_id uuid references public.shop_items on delete set null,
  shop_id uuid references public.shops on delete set null,
  buyer_id uuid references public.profiles on delete set null,
  seller_id uuid references public.profiles on delete set null,
  item_name text not null,
  quantity int not null,
  total bigint not null,
  created_at timestamptz not null default now()
);

insert into public.shops (owner_id, name, description) values
  (null, 'Cavaletti General Store', 'The official store. Age-up credits, feed, tack, and the essentials.');

insert into public.shop_items (shop_id, name, description, category, price, stock, special) values
  ((select id from public.shops where owner_id is null), 'Age-Up Credit', 'Fast-forward one 0-year-old foal by three years so it can hit the show ring.', 'Credits', 7500, null, 'age_credit'),
  ((select id from public.shops where owner_id is null), 'Bag of Senior Feed', 'For the old-timers who still think they''re five.', 'Feed', 35, null, null),
  ((select id from public.shops where owner_id is null), 'Leather Halter w/ Brass Nameplate', 'Engraved with your horse''s barn name.', 'Tack', 120, null, null),
  ((select id from public.shops where owner_id is null), 'All-Purpose Saddle', 'Fits most horses. Fits all budgets? No.', 'Tack', 1800, null, null),
  ((select id from public.shops where owner_id is null), 'Show Sheen (1 gallon)', 'The ring doesn''t care, but you do.', 'Grooming', 25, null, null),
  ((select id from public.shops where owner_id is null), 'Fly Masks (pack of 3)', 'Rainbow, plain, and one with ears.', 'Turnout', 60, null, null),
  ((select id from public.shops where owner_id is null), 'Two-Horse Trailer', 'Bumper pull. Lights work. Mostly.', 'Equipment', 9500, null, null),
  ((select id from public.shops where owner_id is null), 'Tractor + Arena Drag', 'Keep that fancy footing fancy.', 'Equipment', 14000, null, null);

-- ---------------------------------------------------------------------------
-- Forum
-- ---------------------------------------------------------------------------

create table public.forum_categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  description text,
  section text not null default 'Cavaletti',
  sort int not null default 0,
  admin_only boolean not null default false,
  default_kind text not null default 'discussion'
);

insert into public.forum_categories (slug, name, description, section, sort, admin_only, default_kind) values
  ('announcements', 'Announcements', 'News and updates from the Cavaletti staff.', 'Cavaletti', 1, true, 'discussion'),
  ('player-guide', 'Player Guide', 'How everything works. Read this before you buy 40 acres on a whim. (Or don''t. We''re not your mom.)', 'Cavaletti', 2, false, 'discussion'),
  ('questions', 'Questions & Help', 'No dumb questions. A few funny ones.', 'Cavaletti', 3, false, 'discussion'),
  ('game-talk', 'Game Talk & Suggestions', 'Talk about the game itself. Ideas, bugs, wishlists.', 'Cavaletti', 4, false, 'discussion'),
  ('horse-sales', 'Horse Sales', 'Sale ads. Link the horse, set a price, sell it straight from the thread.', 'The Barn Aisle', 10, false, 'sale'),
  ('stud-services', 'Stud Services', 'Advertise your stallions at stud.', 'The Barn Aisle', 11, false, 'stud'),
  ('shows', 'Shows & Competitions', 'Host a show, take entries, post placings. This is where ribbons happen.', 'The Show Grounds', 20, false, 'show'),
  ('show-results', 'Show Results & Brags', 'Post your wins. We''ll clap.', 'The Show Grounds', 21, false, 'discussion'),
  ('associations', 'Associations & Clubs', 'Breed association business, club meetings, elections and drama.', 'The Show Grounds', 22, false, 'discussion'),
  ('stable-life', 'Stable Life', 'Barn diaries, horse stories, roleplay, daily life on the farm.', 'The Tack Room', 30, false, 'discussion'),
  ('off-topic', 'Off Topic', 'Anything that isn''t horses. So... rarely used.', 'The Tack Room', 31, false, 'discussion');

create table public.forum_threads (
  id bigint generated always as identity primary key,
  category_id int not null references public.forum_categories,
  author_id uuid references public.profiles on delete set null,
  title text not null check (char_length(title) between 3 and 140),
  kind text not null default 'discussion' check (kind in ('discussion', 'sale', 'stud', 'show')),
  horse_id uuid references public.horses on delete set null,
  pinned boolean not null default false,
  locked boolean not null default false,
  show_date date,
  show_classes text[] not null default '{}',
  entry_fee bigint not null default 0 check (entry_fee >= 0),
  show_status text check (show_status in ('open', 'closed', 'results')),
  post_count int not null default 0,
  last_post_at timestamptz not null default now(),
  last_post_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
create index forum_threads_cat on public.forum_threads (category_id, pinned desc, last_post_at desc);

create table public.forum_posts (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.forum_threads on delete cascade,
  author_id uuid references public.profiles on delete set null,
  body text not null check (char_length(body) between 1 and 20000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index forum_posts_thread on public.forum_posts (thread_id, created_at);

create table public.show_entries (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.forum_threads on delete cascade,
  horse_id uuid not null references public.horses on delete cascade,
  entrant_id uuid references public.profiles on delete set null,
  class_name text not null,
  place int check (place between 1 and 100),
  created_at timestamptz not null default now(),
  unique (thread_id, horse_id, class_name)
);
create index show_entries_horse on public.show_entries (horse_id);

