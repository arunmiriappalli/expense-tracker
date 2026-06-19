-- Run this in Supabase SQL Editor after creating your project

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  amount numeric(12,2) not null,
  type text not null check (type in ('debit', 'credit')),
  category text not null default 'Other',
  source text not null,
  source_file_name text not null default '',
  card_holder text not null default 'self',
  statement_month int not null,
  statement_year int not null,
  created_at timestamptz default now(),

  -- Prevent duplicate imports
  unique(date, amount, description, source)
);

alter table transactions
  add column if not exists source_file_name text not null default '';

-- Index for dashboard queries
create index if not exists idx_transactions_date on transactions (date);
create index if not exists idx_transactions_year_month on transactions (statement_year, statement_month);
create index if not exists idx_transactions_category on transactions (category);

-- Enable RLS (Row Level Security)
alter table transactions enable row level security;

-- Allow all operations for authenticated users (single-household app)
create policy "Allow all for authenticated" on transactions
  for all to authenticated using (true) with check (true);

-- Also allow anon access if you skip auth initially
create policy "Allow all for anon" on transactions
  for all to anon using (true) with check (true);
