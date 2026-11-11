-- Muyi Sowemimo & Co. CMS. Run in the Supabase SQL Editor. Safe to re-run.
create extension if not exists pgcrypto;
create table if not exists site_pages (slug text primary key, content jsonb not null, updated_at timestamptz default now(), updated_by text);
create table if not exists content_versions (id uuid primary key default gen_random_uuid(), slug text not null, content jsonb not null, saved_by text, created_at timestamptz default now());
create table if not exists posts (id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null, category text default 'Briefing', excerpt text, body text not null default '', cover_url text,
  is_published boolean default false, published_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists media (id uuid primary key default gen_random_uuid(), path text not null, url text not null, name text, size integer, created_at timestamptz default now());
create table if not exists enquiries (id uuid primary key default gen_random_uuid(), type text not null default 'general' check (type in ('general','referral')), name text not null, email text not null, phone text, org text, subject text,
  message text not null, status text not null default 'new' check (status in ('new','handled')), ip text, created_at timestamptz default now());
create table if not exists admin_users (username text primary key, password_hash text not null, role text not null default 'editor', active boolean not null default true, created_at timestamptz default now());
create table if not exists admin_sessions (token_hash text primary key, username text, role text, expires_at timestamptz not null, created_at timestamptz default now());
create table if not exists login_attempts (id uuid primary key default gen_random_uuid(), ip text not null, success boolean default false, created_at timestamptz default now());
create table if not exists keepalive (id int primary key, last_ping timestamptz);
create index if not exists idx_versions on content_versions(slug, created_at desc);
create index if not exists idx_posts_pub on posts(is_published, published_at desc);
create index if not exists idx_enq_ip on enquiries(ip, created_at);
create index if not exists idx_login_ip on login_attempts(ip, created_at);
-- Default-deny: RLS on, no public policies. Only the service-role key (Netlify functions) can read or write.
alter table site_pages enable row level security; alter table content_versions enable row level security; alter table posts enable row level security; alter table media enable row level security;
alter table enquiries enable row level security; alter table keepalive enable row level security; alter table admin_users enable row level security; alter table admin_sessions enable row level security; alter table login_attempts enable row level security;
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('backups', 'backups', false) on conflict (id) do nothing;
select 'Schema ready' as status;
