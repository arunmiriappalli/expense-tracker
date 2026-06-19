-- Run this in Supabase SQL Editor after schema.sql

create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table settings enable row level security;

create policy "Allow all for anon" on settings
  for all to anon using (true) with check (true);

-- Tracks Gmail message IDs that have already been processed.
-- Prevents re-downloading and re-parsing emails on subsequent syncs.
-- A message is NOT recorded if extraction failed due to a wrong/missing password,
-- so fixing the password in .env.local and re-syncing will retry it automatically.
create table if not exists gmail_synced_messages (
  message_id text primary key,
  account text not null,
  synced_at timestamptz default now()
);

alter table gmail_synced_messages enable row level security;

create policy "Allow all for anon" on gmail_synced_messages
  for all to anon using (true) with check (true);
