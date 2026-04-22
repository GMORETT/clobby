-- Enums
create type harness_t as enum ('claude_code', 'codex', 'cursor');
create type presence_status_t as enum ('working', 'needs_input', 'idle');

-- Users (public profile, 1:1 with auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- CLI tokens (long-lived bearer tokens for hooks)
create table public.cli_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  label text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index on public.cli_tokens(token_hash);

-- Device codes (transient, device flow)
create table public.device_codes (
  code text primary key,
  user_id uuid references public.users(id),
  confirmed_at timestamptz,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  cli_token_id uuid references public.cli_tokens(id),
  encrypted_token text,  -- AES-GCM encrypted plaintext token, set on confirm, cleared on consume
  created_at timestamptz not null default now()
);

-- Presence (one row per user+harness)
create table public.presence (
  user_id uuid not null references public.users(id) on delete cascade,
  harness harness_t not null,
  status presence_status_t not null,
  session_id text,
  started_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  primary key (user_id, harness)
);

create index on public.presence(last_event_at);

-- Chat messages
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null check (length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index on public.chat_messages(created_at desc);

-- Avatar color palette (assigned randomly on signup)
create or replace function pick_avatar_color() returns text language sql as $$
  select (array[
    '#6366f1','#ec4899','#f59e0b','#10b981',
    '#3b82f6','#ef4444','#8b5cf6','#14b8a6',
    '#f97316','#84cc16','#06b6d4','#a855f7'
  ])[floor(random() * 12 + 1)::int];
$$;

-- Trigger: auto-create public.users row when auth.users row is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := coalesce(
    new.raw_user_meta_data->>'user_name',
    split_part(new.email, '@', 1),
    'user'
  );
  final_username := base_username;

  -- Ensure uniqueness
  loop
    exit when not exists (select 1 from public.users where username = final_username);
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  insert into public.users (id, username, avatar_color)
  values (new.id, final_username, pick_avatar_color());

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
