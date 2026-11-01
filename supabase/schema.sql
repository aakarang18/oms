-- =====================================================================
-- Casa Atleta — database schema
-- Run this ONCE in Supabase → SQL Editor → New query → paste → Run.
-- Then run seed.sql to create the Jhumka City Run event and races.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- events ----------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  code_prefix text not null default 'EVT',          -- used in registration IDs, e.g. JCR
  name text not null,
  tagline text,
  description text,
  event_date date,                                   -- null = "To be announced"
  venue text,
  start_point text,
  reporting_time text,
  bib_collection text,
  hydration text,
  medical text,
  guidelines text,
  parking text,
  baggage text,
  race_kit text,
  awards text,
  registration_closes_at timestamptz,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger events_updated before update on events for each row execute function set_updated_at();

-- ---------- races (distances) ----------
create table if not exists races (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  code text not null,                                -- 5K, 10K, 21K, KID
  name text not null,                                -- "21K Half Marathon"
  positioning text,                                  -- "Push your limits"
  audience text,                                     -- "Regular runners…"
  distance_label text,                               -- "21.1 km"
  is_kids boolean not null default false,
  fee_paise integer check (fee_paise is null or fee_paise >= 0),   -- ₹499 = 49900; null = not set
  capacity integer check (capacity is null or capacity >= 0),       -- null = not set
  status text not null default 'coming_soon'
    check (status in ('coming_soon','open','paused','closed')),
  flag_off text,
  cut_off text,
  min_age integer,
  max_age integer,
  route_map_url text,
  elevation text,
  start_finish text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, code)
);
create trigger races_updated before update on races for each row execute function set_updated_at();

-- ---------- registrations ----------
create sequence if not exists registration_number_seq start 1;

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  reg_code text unique,                              -- e.g. JCR-21K-000123 (set when paid)
  event_id uuid not null references events(id),
  race_id uuid not null references races(id),
  status text not null default 'pending'
    check (status in ('pending','paid','failed','expired','cancelled')),
  -- participant (for Kids Run this is the child)
  full_name text not null,
  dob date not null,
  gender text not null,
  email text not null,                               -- guardian's email for Kids Run
  mobile text not null,                              -- guardian's mobile for Kids Run
  city text not null,
  tshirt_size text not null,
  running_club text,
  emergency_name text not null,
  emergency_mobile text not null,
  medical_info text,
  medical_consent boolean not null default false,
  guardian_name text,
  guardian_relation text,
  -- consents
  accepted_terms boolean not null,
  accepted_waiver boolean not null,
  accepted_privacy boolean not null,
  guardian_consent boolean not null default false,
  photo_consent boolean not null default false,
  whatsapp_opt_in boolean not null default false,
  -- payment
  amount_paise integer not null default 0,
  razorpay_order_id text unique,
  razorpay_payment_id text,
  payment_method text,
  failure_reason text,
  paid_at timestamptz,
  expires_at timestamptz,                            -- pending holds expire (frees the place)
  confirmation_sent_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists registrations_race_status on registrations (race_id, status);
create index if not exists registrations_email on registrations (lower(email));
create index if not exists registrations_created on registrations (created_at);
create trigger registrations_updated before update on registrations for each row execute function set_updated_at();

-- ---------- content ----------
create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  question text not null,
  answer text not null,
  sort integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  title text not null,
  body text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website_url text,
  tier text not null default 'partner',             -- title, associate, community, partner
  sort integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- enquiries ----------
create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  consent boolean not null default true,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  name text not null,
  email text not null,
  mobile text,
  reg_code text,
  message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists partner_enquiries (
  id uuid primary key default gen_random_uuid(),
  org_type text not null,
  org_name text not null,
  contact_name text not null,
  email text not null,
  mobile text,
  interests text[] not null default '{}',
  message text,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- admin ----------
create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'editor' check (role in ('admin','editor')),
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  actor_email text,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists payment_events (
  id text primary key,                               -- Razorpay webhook event id (idempotency)
  event_type text not null,
  payload jsonb,
  received_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
-- All data is read/written by the website's server using the service-role key.
-- RLS is ON with no public policies, so the public "anon" key cannot read anything.
alter table events enable row level security;
alter table races enable row level security;
alter table registrations enable row level security;
alter table faqs enable row level security;
alter table announcements enable row level security;
alter table sponsors enable row level security;
alter table newsletter_subscribers enable row level security;
alter table contact_messages enable row level security;
alter table partner_enquiries enable row level security;
alter table admin_users enable row level security;
alter table audit_log enable row level security;
alter table payment_events enable row level security;

-- =====================================================================
-- Business rules (run inside the database so they are always enforced)
-- =====================================================================

-- Gives a paid registration its human-friendly ID, e.g. JCR-21K-000123
create or replace function assign_reg_code(p_reg_id uuid) returns text
language plpgsql as $$
declare
  v_code text;
begin
  select e.code_prefix || '-' || ra.code || '-' || lpad(nextval('registration_number_seq')::text, 6, '0')
    into v_code
    from registrations r
    join races ra on ra.id = r.race_id
    join events e on e.id = r.event_id
   where r.id = p_reg_id;
  update registrations set reg_code = v_code where id = p_reg_id and reg_code is null;
  return v_code;
end $$;

-- Creates a registration while preventing overselling.
-- Places held by unpaid registrations are released after 30 minutes.
create or replace function create_registration(p jsonb)
returns table (reg_id uuid, amount integer, reg_status text)
language plpgsql as $$
declare
  v_race races%rowtype;
  v_event events%rowtype;
  v_taken integer;
  v_id uuid;
begin
  select * into v_race from races where id = (p->>'race_id')::uuid for update;
  if not found then raise exception 'RACE_NOT_FOUND'; end if;
  select * into v_event from events where id = v_race.event_id;

  if v_race.status <> 'open' then raise exception 'RACE_NOT_OPEN'; end if;
  if v_event.registration_closes_at is not null and now() > v_event.registration_closes_at then
    raise exception 'REGISTRATION_CLOSED';
  end if;
  if v_race.fee_paise is null then raise exception 'FEE_NOT_SET'; end if;
  if v_race.capacity is null then raise exception 'CAPACITY_NOT_SET'; end if;

  select count(*) into v_taken from registrations
   where race_id = v_race.id
     and (status = 'paid' or (status = 'pending' and expires_at > now()));
  if v_taken >= v_race.capacity then raise exception 'RACE_FULL'; end if;

  if exists (
    select 1 from registrations
     where race_id = v_race.id and status = 'paid'
       and lower(email) = lower(p->>'email')
       and lower(full_name) = lower(p->>'full_name')
       and dob = (p->>'dob')::date
  ) then
    raise exception 'DUPLICATE';
  end if;

  insert into registrations (
    event_id, race_id, status, full_name, dob, gender, email, mobile, city, tshirt_size,
    running_club, emergency_name, emergency_mobile, medical_info, medical_consent,
    guardian_name, guardian_relation, accepted_terms, accepted_waiver, accepted_privacy,
    guardian_consent, photo_consent, whatsapp_opt_in, amount_paise, expires_at
  ) values (
    v_race.event_id, v_race.id, 'pending', p->>'full_name', (p->>'dob')::date, p->>'gender',
    lower(p->>'email'), p->>'mobile', p->>'city', p->>'tshirt_size', nullif(p->>'running_club',''),
    p->>'emergency_name', p->>'emergency_mobile', nullif(p->>'medical_info',''),
    coalesce((p->>'medical_consent')::boolean, false),
    nullif(p->>'guardian_name',''), nullif(p->>'guardian_relation',''),
    (p->>'accepted_terms')::boolean, (p->>'accepted_waiver')::boolean, (p->>'accepted_privacy')::boolean,
    coalesce((p->>'guardian_consent')::boolean, false), coalesce((p->>'photo_consent')::boolean, false),
    coalesce((p->>'whatsapp_opt_in')::boolean, false), v_race.fee_paise, now() + interval '30 minutes'
  ) returning id into v_id;

  -- Free races (fee 0) are confirmed immediately.
  if v_race.fee_paise = 0 then
    update registrations set status = 'paid', paid_at = now(), payment_method = 'free' where id = v_id;
    perform assign_reg_code(v_id);
    return query select v_id, 0, 'paid'::text;
  else
    return query select v_id, v_race.fee_paise, 'pending'::text;
  end if;
end $$;

-- Marks a registration as paid. Safe to call more than once (webhook + browser).
create or replace function mark_registration_paid(p_order_id text, p_payment_id text, p_method text)
returns table (reg_id uuid, newly_paid boolean)
language plpgsql as $$
declare
  v_reg registrations%rowtype;
begin
  select * into v_reg from registrations where razorpay_order_id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_reg.status = 'paid' then
    return query select v_reg.id, false;
    return;
  end if;
  update registrations
     set status = 'paid', paid_at = now(), razorpay_payment_id = p_payment_id,
         payment_method = p_method, failure_reason = null
   where id = v_reg.id;
  perform assign_reg_code(v_reg.id);
  return query select v_reg.id, true;
end $$;

create or replace function mark_registration_failed(p_order_id text, p_payment_id text, p_reason text)
returns void
language plpgsql as $$
begin
  update registrations
     set status = 'failed', razorpay_payment_id = coalesce(p_payment_id, razorpay_payment_id),
         failure_reason = p_reason
   where razorpay_order_id = p_order_id and status = 'pending';
end $$;

-- Numbers for the admin dashboard
create or replace function admin_stats(p_event uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'by_race', (
      select coalesce(jsonb_agg(x order by x.sort), '[]'::jsonb) from (
        select ra.id, ra.code, ra.name, ra.capacity, ra.status, ra.sort, ra.fee_paise,
          count(r.*) filter (where r.status = 'paid') as paid,
          count(r.*) filter (where r.status = 'pending' and r.expires_at > now()) as pending,
          count(r.*) filter (where r.status = 'failed') as failed,
          coalesce(sum(r.amount_paise) filter (where r.status = 'paid'), 0) as revenue_paise
        from races ra left join registrations r on r.race_id = ra.id
        where ra.event_id = p_event
        group by ra.id
      ) x
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'count', d.n) order by d.day), '[]'::jsonb) from (
        select gs::date as day,
          (select count(*) from registrations r
            where r.event_id = p_event and r.status = 'paid'
              and (r.paid_at at time zone 'Asia/Kolkata')::date = gs::date) as n
        from generate_series((now() at time zone 'Asia/Kolkata')::date - 29,
                             (now() at time zone 'Asia/Kolkata')::date, interval '1 day') gs
      ) d
    ),
    'cities', (
      select coalesce(jsonb_agg(jsonb_build_object('city', c.city, 'count', c.n) order by c.n desc), '[]'::jsonb) from (
        select initcap(trim(city)) as city, count(*) as n from registrations
         where event_id = p_event and status = 'paid'
         group by initcap(trim(city)) order by n desc limit 8
      ) c
    )
  );
$$;
