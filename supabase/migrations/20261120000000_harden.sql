-- Hardening after a security review.
--
-- The settings row, the section signs and the site texts are only ever
-- edited from the admin panel, never added or removed. Removing them would
-- break the next publish, so admins (and anyone who got hold of an admin's
-- login) can now only change them.
revoke insert, delete on public.site_settings from authenticated;
revoke insert, delete on public.sections from authenticated;
revoke insert, delete on public.content_blocks from authenticated;

-- Indexes for the links between tables (Supabase's performance advice), so
-- opening an inquiry or a payment list stays quick as orders build up.
create index if not exists inquiries_occasion_id_idx on public.inquiries (occasion_id);
create index if not exists inquiries_size_id_idx on public.inquiries (size_id);
create index if not exists inquiries_base_id_idx on public.inquiries (base_id);
create index if not exists inquiries_frosting_id_idx on public.inquiries (frosting_id);
create index if not exists inquiries_section_key_idx on public.inquiries (section_key);
create index if not exists inquiry_photos_inquiry_id_idx on public.inquiry_photos (inquiry_id);
create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists publish_log_requested_by_idx on public.publish_log (requested_by);

-- The order form's limits: a fingerprint of each visitor's internet address
-- (never the address itself), so one visitor can't send dozens of orders.
alter table public.inquiries add column if not exists visitor text;
create index if not exists inquiries_visitor_idx on public.inquiries (visitor, created_at);
create index if not exists inquiries_created_at_idx on public.inquiries (created_at);
