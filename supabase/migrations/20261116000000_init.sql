-- Phase 1: the shop's database.
--
-- What the site shows (settings, sections, texts, products, photos, gallery,
-- cake options), what customers send (cake inquiries and their photos), the
-- groundwork for orders and payments, and the admins and logs behind the
-- admin panel.
--
-- Security model:
-- * Every table has row-level security. Visitors (anon) can only read what is
--   published. Only admins can change anything.
-- * Customers never write to the database directly: the site's server code
--   (Cloudflare Functions) stores inquiries with the service key after a spam
--   check, and hands out short-lived signed links for their photo uploads.
-- * Admins are the people listed in `admins`. Someone becomes one by signing
--   in with an email an owner has invited (`admin_invites`); public sign-ups
--   are switched off in the Supabase dashboard.

-- ---------- Helpers ----------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------- Admins ----------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now()
);

-- Emails that become admins when that person signs in (or already has).
create table public.admin_invites (
  email text primary key check (email = lower(email) and email like '%_@_%'),
  role text not null default 'editor' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()) and role = 'owner')
$$;

-- A new account is an admin only if its email was invited.
create function public.admin_from_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admins (user_id, email, role)
  select new.id, lower(new.email), i.role
  from public.admin_invites i
  where i.email = lower(new.email)
  on conflict (user_id) do nothing;
  return new;
end
$$;

create trigger admin_from_invite
after insert on auth.users
for each row execute function public.admin_from_invite();

-- Inviting someone who already has an account makes them an admin at once.
create function public.admin_from_existing_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admins (user_id, email, role)
  select u.id, new.email, new.role
  from auth.users u
  where lower(u.email) = new.email
  on conflict (user_id) do update set role = excluded.role;
  return new;
end
$$;

create trigger admin_from_existing_user
after insert or update on public.admin_invites
for each row execute function public.admin_from_existing_user();

-- The team always keeps at least one owner, so nobody can lock everyone out:
-- a change that removes or demotes the last owner is refused.
create function public.keep_an_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from old_rows where role = 'owner')
    and not exists (select 1 from public.admins where role = 'owner') then
    raise exception 'The team needs at least one owner.';
  end if;
  return null;
end
$$;

create trigger keep_an_owner_on_update
after update on public.admins
referencing old table as old_rows
for each statement execute function public.keep_an_owner();

create trigger keep_an_owner_on_delete
after delete on public.admins
referencing old table as old_rows
for each statement execute function public.keep_an_owner();

-- ---------- What the site shows ----------

-- One row: business name, contact details, payment details and SEO defaults.
create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  business_name text not null,
  tagline text not null default '',
  whatsapp text not null default '' check (whatsapp ~ '^[0-9]{0,15}$'),
  email text not null default '',
  instagram text not null default '' check (instagram ~ '^[A-Za-z0-9._]{0,30}$'),
  upi_id text not null default '',
  upi_qr_path text,
  seo_title text not null default '',
  seo_description text not null default '',
  updated_at timestamptz not null default now()
);

-- The shop's sections: Aiden's Decor and Alita's Cakes.
create table public.sections (
  key text primary key check (key ~ '^[a-z][a-z0-9-]*$'),
  name text not null,
  short_name text not null,
  named_for text not null default '',
  line text not null default '',
  enquiry_text text not null default '',
  cover_path text,
  -- What the section's sign lists ([{label, href}]) and the photos around it.
  aisles jsonb not null default '[]',
  sign_photos text[] not null default '{}',
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

-- Every other text on the site (headlines, chapter texts, steps...), one
-- block per part of the page, so the admin panel can edit each part.
create table public.content_blocks (
  key text primary key check (key ~ '^[a-z][a-zA-Z0-9_.-]*$'),
  label text not null,
  value jsonb not null,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  section_key text not null references public.sections (key) on update cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 120),
  category text not null default '',
  description text not null default '' check (char_length(description) <= 4000),
  price_from numeric(10, 2) check (price_from >= 0),
  tags text[] not null default '{}',
  is_published boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_section_sort on public.products (section_key, sort);

-- `path` is the photo's name in the public-media bucket, without size or
-- extension: the site uses `<path>-640.webp` and `<path>-1280.webp`.
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null unique,
  width int not null check (width > 0),
  height int not null check (height > 0),
  alt text not null default '',
  focus text check (focus ~ '^[0-9]{1,3}% [0-9]{1,3}%$'),
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_sort on public.product_images (product_id, sort);

create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null unique references public.product_images (id) on delete cascade,
  sort int not null default 0,
  is_visible boolean not null default true
);

-- Choices on the cake inquiry form, with the price change each one makes.
create table public.cake_options (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('occasion', 'size', 'base', 'frosting')),
  label text not null check (char_length(label) between 1 and 80),
  description text not null default '',
  price_delta numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  sort int not null default 0,
  unique (kind, label)
);

-- ---------- What customers send ----------

create sequence public.inquiry_number;

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('INQ-' || lpad(nextval('public.inquiry_number')::text, 5, '0')),
  section_key text not null default 'cakes' references public.sections (key) on update cascade,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'quoted', 'confirmed', 'paid', 'delivered', 'cancelled')),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  customer_phone text not null check (customer_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  customer_email text check (customer_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  event_date date,
  occasion_id uuid references public.cake_options (id) on delete set null,
  size_id uuid references public.cake_options (id) on delete set null,
  base_id uuid references public.cake_options (id) on delete set null,
  frosting_id uuid references public.cake_options (id) on delete set null,
  -- The options' labels and prices as the customer saw them, in case the
  -- options are changed later.
  options_snapshot jsonb not null default '{}',
  notes text not null default '' check (char_length(notes) <= 2000),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inquiries_status_created on public.inquiries (status, created_at desc);

-- Inspiration photos, stored in the private inquiry-uploads bucket.
create table public.inquiry_photos (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  path text not null unique,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  size_bytes int not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default now()
);

-- ---------- Orders and payments (groundwork for a payment gateway) ----------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid unique references public.inquiries (id) on delete set null,
  status text not null default 'quoted'
    check (status in ('quoted', 'awaiting_payment', 'advance_paid', 'paid', 'cancelled', 'refunded')),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  total numeric(10, 2) not null check (total >= 0),
  advance_due numeric(10, 2) not null default 0 check (advance_due >= 0 and advance_due <= total),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Today: payments made by UPI over WhatsApp, recorded by hand. Later: rows
-- written by a gateway's webhook (Razorpay, Cashfree...), matched by
-- provider_ref.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null default 'upi_whatsapp'
    check (provider in ('upi_whatsapp', 'cash', 'bank_transfer', 'razorpay', 'cashfree', 'other')),
  provider_ref text,
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'succeeded' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);

create unique index payments_provider_ref on public.payments (provider, provider_ref) where provider_ref is not null;

-- ---------- Logs ----------

-- Each press of Publish, and how the rebuild went.
create table public.publish_log (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid default auth.uid() references auth.users (id) on delete set null,
  status text not null default 'requested' check (status in ('requested', 'building', 'live', 'failed')),
  deploy_id text,
  message text not null default '',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Who changed what, written by triggers.
create table public.activity_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  table_name text not null,
  row_key text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create index activity_log_at on public.activity_log (at desc);

create function public.log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.activity_log (actor, action, table_name, row_key, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'key', row_data ->> 'user_id', row_data ->> 'email'),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end
$$;

-- ---------- Triggers ----------

create trigger set_updated_at before update on public.site_settings for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.sections for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.content_blocks for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.inquiries for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.orders for each row execute function public.set_updated_at();

create trigger log_activity after insert or update or delete on public.site_settings for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.sections for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.content_blocks for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.products for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.product_images for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.gallery_items for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.cake_options for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.admins for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.admin_invites for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.orders for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.payments for each row execute function public.log_activity();
-- New inquiries come from customers; only admins' changes to them are logged.
create trigger log_activity after update or delete on public.inquiries for each row execute function public.log_activity();

-- ---------- Dashboard ----------

-- Counts for the admin dashboard. Runs with the caller's rights, so anyone
-- but an admin gets zeros.
create function public.dashboard_summary() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'new_inquiries', (select count(*) from public.inquiries where status = 'new'),
    'open_inquiries', (select count(*) from public.inquiries where status not in ('delivered', 'cancelled')),
    'awaiting_payment', (select count(*) from public.orders where status in ('awaiting_payment', 'advance_paid')),
    'products_published', (select count(*) from public.products where is_published),
    'products_hidden', (select count(*) from public.products where not is_published),
    'last_publish', (
      select to_jsonb(p) from (
        select status, message, created_at, finished_at from public.publish_log order by created_at desc limit 1
      ) p
    )
  )
$$;

-- ---------- Access ----------

alter table public.admins enable row level security;
alter table public.admin_invites enable row level security;
alter table public.site_settings enable row level security;
alter table public.sections enable row level security;
alter table public.content_blocks enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.gallery_items enable row level security;
alter table public.cake_options enable row level security;
alter table public.inquiries enable row level security;
alter table public.inquiry_photos enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.publish_log enable row level security;
alter table public.activity_log enable row level security;

-- Grants are spelled out rather than left to the platform's defaults: visitors
-- get read access to the public tables only, signed-in users go through the
-- policies below, and private tables are closed to visitors entirely.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.site_settings, public.sections, public.content_blocks, public.products,
  public.product_images, public.gallery_items, public.cake_options to anon, authenticated;
grant insert, update, delete on public.site_settings, public.sections, public.content_blocks, public.products,
  public.product_images, public.gallery_items, public.cake_options to authenticated;
grant select, insert, update, delete on public.admins, public.admin_invites, public.inquiries,
  public.inquiry_photos, public.orders, public.payments to authenticated;
grant select, insert on public.publish_log to authenticated;
grant select on public.activity_log to authenticated;
grant execute on function public.is_admin(), public.is_owner() to anon, authenticated;
grant execute on function public.dashboard_summary() to authenticated;

-- Admins: everyone on the team can see the team; only owners change it.
create policy "Admins see the team" on public.admins for select to authenticated using (public.is_admin());
create policy "Owners manage the team" on public.admins for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy "Owners manage invites" on public.admin_invites for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Public content: anyone reads what is published; admins read and change all.
create policy "Anyone reads settings" on public.site_settings for select to anon, authenticated using (true);
create policy "Admins change settings" on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Anyone reads sections" on public.sections for select to anon, authenticated using (true);
create policy "Admins change sections" on public.sections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Anyone reads texts" on public.content_blocks for select to anon, authenticated using (true);
create policy "Admins change texts" on public.content_blocks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Anyone reads published products" on public.products for select to anon, authenticated
  using (is_published or public.is_admin());
create policy "Admins change products" on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Anyone reads published products' photos" on public.product_images for select to anon, authenticated
  using (public.is_admin() or exists (
    select 1 from public.products p where p.id = product_id and p.is_published
  ));
create policy "Admins change product photos" on public.product_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Anyone reads the visible gallery" on public.gallery_items for select to anon, authenticated
  using (public.is_admin() or (is_visible and exists (
    select 1 from public.product_images i join public.products p on p.id = i.product_id
    where i.id = image_id and p.is_published
  )));
create policy "Admins change the gallery" on public.gallery_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Anyone reads active cake options" on public.cake_options for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "Admins change cake options" on public.cake_options for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Private: admins only. (The server code uses the service key, which is not
-- subject to these policies, to store new inquiries.)
create policy "Admins handle inquiries" on public.inquiries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins handle inquiry photos" on public.inquiry_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins handle orders" on public.orders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins handle payments" on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins see publishes" on public.publish_log for select to authenticated using (public.is_admin());
create policy "Admins publish" on public.publish_log for insert to authenticated
  with check (public.is_admin() and requested_by = (select auth.uid()) and status = 'requested');

create policy "Admins see activity" on public.activity_log for select to authenticated using (public.is_admin());

-- ---------- Storage ----------

-- public-media: the site's photos, readable by anyone through their public
-- address (no listing), uploaded only by admins. SVG is left out because it
-- can carry scripts.
-- inquiry-uploads: customers' inspiration photos. Private: only admins can
-- open them; customers upload through signed links from the server code.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-media', 'public-media', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/avif']),
  ('inquiry-uploads', 'inquiry-uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins manage site photos" on storage.objects for all to authenticated
  using (bucket_id = 'public-media' and public.is_admin())
  with check (bucket_id = 'public-media' and public.is_admin());

create policy "Admins open inquiry photos" on storage.objects for select to authenticated
  using (bucket_id = 'inquiry-uploads' and public.is_admin());
create policy "Admins delete inquiry photos" on storage.objects for delete to authenticated
  using (bucket_id = 'inquiry-uploads' and public.is_admin());
