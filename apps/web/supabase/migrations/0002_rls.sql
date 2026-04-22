-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.cli_tokens enable row level security;
alter table public.device_codes enable row level security;
alter table public.presence enable row level security;
alter table public.chat_messages enable row level security;

-- users: any authenticated user can read, only owner can update
create policy "users: public read"
  on public.users for select
  to authenticated
  using (true);

create policy "users: owner update"
  on public.users for update
  to authenticated
  using (auth.uid() = id);

-- cli_tokens: owner can read their own; insert/update/delete only via service role
create policy "cli_tokens: owner read"
  on public.cli_tokens for select
  to authenticated
  using (auth.uid() = user_id);

-- device_codes: no client access at all (service role only)
-- (no policies = no access for non-service-role)

-- presence: any authenticated user can read; insert/update/delete only via service role
create policy "presence: public read"
  on public.presence for select
  to authenticated
  using (true);

-- chat_messages: any authenticated user can read; insert only via service role
create policy "chat_messages: public read"
  on public.chat_messages for select
  to authenticated
  using (true);
