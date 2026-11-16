-- Checks who can see and change what. Run by scripts/test-db.sh after the
-- migrations and seed. Each check raises an error (and stops the run) if it
-- fails.

\set ON_ERROR_STOP on

create schema test;
grant usage on schema test to anon, authenticated, service_role;

create function test.ok(passed boolean, what text) returns void
language plpgsql as $$
begin
  if passed is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end
$$;

-- Acts as a signed-in user (or, with null, as a visitor) for later statements.
create function test.sign_in(uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', coalesce(json_build_object('sub', uid)::text, ''), false)
$$;
grant execute on all functions in schema test to anon, authenticated, service_role;

-- People: the owner (invited before signing in), an editor (invited after
-- having an account) and someone with an account who was never invited.
insert into public.admin_invites (email, role) values ('owner@example.com', 'owner');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'Owner@Example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'editor@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@example.com');

-- ---------- The site's server code (service key) stores an inquiry ----------
set role service_role;
insert into public.inquiries (customer_name, customer_phone, customer_email, notes)
values ('Test Customer', '+91 98000 00000', 'customer@example.com', 'Two tiers, lilac');
insert into public.inquiry_photos (inquiry_id, path, mime, size_bytes)
select id, 'INQ-00001/inspiration-1.jpg', 'image/jpeg', 200000 from public.inquiries;
insert into storage.objects (bucket_id, name) values ('inquiry-uploads', 'INQ-00001/inspiration-1.jpg');
select test.ok((select ref from public.inquiries) = 'INQ-00001', 'inquiries get a reference number');
do $$ begin
  insert into public.inquiries (customer_name, customer_phone) values ('Bad', 'call me');
  raise exception 'FAILED: an invalid phone number was accepted';
exception when check_violation then raise notice 'ok: invalid phone numbers are refused';
end $$;
reset role;

-- ---------- A visitor ----------
set role anon;
select test.sign_in(null);
select test.ok((select count(*) from public.products) = 41, 'visitors see the 41 published products');
select test.ok(not exists (select 1 from public.products where not is_published), 'visitors never see hidden products');
select test.ok((select count(*) from public.product_images) = 41, 'visitors see only published products'' photos');
select test.ok((select count(*) from public.gallery_items) = 22, 'visitors see the gallery');
select test.ok((select count(*) from public.sections) = 2, 'visitors see both sections');
select test.ok((select business_name from public.site_settings) is not null, 'visitors see the site settings');
select test.ok(not public.is_admin(), 'a visitor is not an admin');
do $$ begin
  perform 1 from public.inquiries;
  raise exception 'FAILED: a visitor could read inquiries';
exception when insufficient_privilege then raise notice 'ok: visitors cannot read inquiries';
end $$;
do $$ begin
  insert into public.inquiries (customer_name, customer_phone) values ('Spam', '+910000000000');
  raise exception 'FAILED: a visitor could add an inquiry directly';
exception when insufficient_privilege then raise notice 'ok: visitors cannot add inquiries directly';
end $$;
do $$ begin
  update public.products set title = 'Hacked';
  raise exception 'FAILED: a visitor could change products';
exception when insufficient_privilege then raise notice 'ok: visitors cannot change products';
end $$;
do $$ begin
  perform 1 from public.admins;
  raise exception 'FAILED: a visitor could see the admins';
exception when insufficient_privilege then raise notice 'ok: visitors cannot see the admins';
end $$;
do $$ begin
  perform 1 from public.activity_log;
  raise exception 'FAILED: a visitor could read the activity log';
exception when insufficient_privilege then raise notice 'ok: visitors cannot read the activity log';
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('public-media', 'products/evil');
  raise exception 'FAILED: a visitor could upload to the site photos';
exception when insufficient_privilege then raise notice 'ok: visitors cannot upload site photos';
end $$;
select test.ok((select count(*) from storage.objects where bucket_id = 'inquiry-uploads') = 0, 'visitors cannot open customers'' photos');
reset role;

-- ---------- Someone signed in who is not an admin ----------
set role authenticated;
select test.sign_in('00000000-0000-0000-0000-00000000000c');
select test.ok(not public.is_admin(), 'an uninvited account is not an admin');
select test.ok((select count(*) from public.inquiries) = 0, 'an uninvited account sees no inquiries');
select test.ok((select count(*) from public.inquiry_photos) = 0, 'an uninvited account sees no inquiry photos');
select test.ok((select count(*) from public.admins) = 0, 'an uninvited account cannot see the admins');
select test.ok((select (public.dashboard_summary() ->> 'new_inquiries')::int) = 0, 'an uninvited account''s dashboard shows nothing');
with changed as (update public.products set title = 'Hacked' returning 1)
select test.ok((select count(*) from changed) = 0, 'an uninvited account cannot change products');
do $$ begin
  insert into public.admins (user_id, email, role) values ('00000000-0000-0000-0000-00000000000c', 'stranger@example.com', 'owner');
  raise exception 'FAILED: an uninvited account made itself an admin';
exception when insufficient_privilege then raise notice 'ok: an uninvited account cannot make itself an admin';
end $$;
do $$ begin
  insert into public.publish_log (status) values ('requested');
  raise exception 'FAILED: an uninvited account could publish';
exception when insufficient_privilege then raise notice 'ok: an uninvited account cannot publish';
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('public-media', 'products/evil');
  raise exception 'FAILED: an uninvited account could upload site photos';
exception when insufficient_privilege then raise notice 'ok: an uninvited account cannot upload site photos';
end $$;
select test.ok((select count(*) from storage.objects where bucket_id = 'inquiry-uploads') = 0, 'an uninvited account cannot open customers'' photos');
reset role;

-- ---------- The owner ----------
set role authenticated;
select test.sign_in('00000000-0000-0000-0000-00000000000a');
select test.ok(public.is_admin() and public.is_owner(), 'an invited owner becomes an owner when signing in');
select test.ok((select count(*) from public.products) = 42, 'admins also see hidden products');
select test.ok((select count(*) from public.inquiries) = 1, 'admins see inquiries');
select test.ok((select (public.dashboard_summary() ->> 'new_inquiries')::int) = 1, 'the dashboard counts new inquiries');
update public.inquiries set status = 'contacted', admin_notes = 'Called on WhatsApp';
select test.ok(exists (
  select 1 from public.activity_log
  where table_name = 'inquiries' and action = 'update' and actor = '00000000-0000-0000-0000-00000000000a'
), 'changes are logged with who made them');
update public.products set price_from = 1500 where slug = 'cake-lion-one-month';
select test.ok((select price_from from public.products where slug = 'cake-lion-one-month') = 1500, 'admins change products');
insert into storage.objects (bucket_id, name) values ('public-media', 'products/new-piece-640.webp');
select test.ok(true, 'admins upload site photos');
select test.ok((select count(*) from storage.objects where bucket_id = 'inquiry-uploads') = 1, 'admins open customers'' photos');
insert into public.publish_log (status) values ('requested');
select test.ok(true, 'admins can press Publish');
do $$ begin
  insert into public.publish_log (status) values ('live');
  raise exception 'FAILED: an admin could mark a publish as live';
exception when insufficient_privilege then raise notice 'ok: only the server marks a publish as done';
end $$;
insert into public.admin_invites (email, role) values ('editor@example.com', 'editor');
select test.ok(exists (select 1 from public.admins where email = 'editor@example.com' and role = 'editor'),
  'inviting someone who already has an account makes them an admin');
do $$ begin
  delete from public.admins where user_id = '00000000-0000-0000-0000-00000000000a';
  raise exception 'FAILED: the last owner could remove themselves';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: the last owner cannot be removed';
end $$;
reset role;

-- ---------- An editor ----------
set role authenticated;
select test.sign_in('00000000-0000-0000-0000-00000000000b');
select test.ok(public.is_admin() and not public.is_owner(), 'an editor is an admin but not an owner');
update public.content_blocks set value = jsonb_set(value, '{text}', '"New statement"') where key = 'statement';
select test.ok((select value ->> 'text' from public.content_blocks where key = 'statement') = 'New statement', 'editors change texts');
do $$ begin
  insert into public.admin_invites (email) values ('friend@example.com');
  raise exception 'FAILED: an editor could invite admins';
exception when insufficient_privilege then raise notice 'ok: editors cannot invite admins';
end $$;
with removed as (delete from public.admins where role = 'owner' returning 1)
select test.ok((select count(*) from removed) = 0, 'editors cannot remove the owner');
reset role;

select test.sign_in(null);
\echo 'All access checks passed.'
