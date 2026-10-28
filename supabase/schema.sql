-- Betwise schema: run in Supabase SQL Editor.
-- All user-owned tables have RLS enabled and policies scoped to auth.uid().
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  initial_bankroll numeric(14,2) not null default 0 check (initial_bankroll >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null check (sport in ('Cricket','Football','Tennis','Basketball','Other')),
  event_name text not null check (length(trim(event_name)) > 0 and length(event_name) <= 240),
  market text not null default 'Unspecified' check (length(market) <= 160),
  selection text not null check (length(trim(selection)) > 0 and length(selection) <= 240),
  bookmaker text not null default '' check (length(bookmaker) <= 160),
  bet_type text not null default 'single' check (bet_type in ('single','accumulator','system')),
  odds numeric(10,3) not null check (odds >= 1 and odds <= 100000),
  stake numeric(14,2) not null check (stake > 0),
  status text not null default 'pending' check (status in ('pending','won','lost','void','cashout','partial')),
  actual_return numeric(14,2) null check (actual_return >= 0),
  placed_at timestamptz not null default now(),
  settled_at timestamptz null,
  notes text null check (length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settled_return_required check (
    (status in ('pending','void')) or actual_return is not null
  ),
  constraint pending_not_settled check (
    status <> 'pending' or settled_at is null
  )
);

create table if not exists public.bet_legs (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null,
  event_name text not null,
  market text not null default '',
  selection text not null,
  odds numeric(10,3) not null check (odds >= 1),
  status text not null default 'pending' check (status in ('pending','won','lost','void')),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('deposit','withdrawal','adjustment')),
  amount numeric(14,2) not null check (amount > 0),
  occurred_at timestamptz not null default now(),
  note text null check (length(note) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.bankroll_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null default current_date,
  balance numeric(14,2) not null,
  net_profit numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique(user_id, snapshot_date)
);

create table if not exists public.limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  daily_stake_limit numeric(14,2) null check (daily_stake_limit is null or daily_stake_limit >= 0),
  monthly_loss_limit numeric(14,2) null check (monthly_loss_limit is null or monthly_loss_limit >= 0),
  session_minutes_limit integer null check (session_minutes_limit is null or session_minutes_limit between 1 and 1440),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bets_user_placed_idx on public.bets(user_id, placed_at desc);
create index if not exists bets_user_status_idx on public.bets(user_id, status);
create index if not exists bets_user_sport_idx on public.bets(user_id, sport);
create index if not exists transactions_user_date_idx on public.transactions(user_id, occurred_at desc);
create index if not exists bet_legs_user_idx on public.bet_legs(user_id, bet_id);

alter table public.profiles enable row level security;
alter table public.bets enable row level security;
alter table public.bet_legs enable row level security;
alter table public.transactions enable row level security;
alter table public.bankroll_snapshots enable row level security;
alter table public.limits enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "bets select own" on public.bets;
create policy "bets select own" on public.bets for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "bets insert own" on public.bets;
create policy "bets insert own" on public.bets for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "bets update own" on public.bets;
create policy "bets update own" on public.bets for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "bets delete own" on public.bets;
create policy "bets delete own" on public.bets for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "bet legs select own" on public.bet_legs;
create policy "bet legs select own" on public.bet_legs for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "bet legs insert own" on public.bet_legs;
create policy "bet legs insert own" on public.bet_legs for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "bet legs update own" on public.bet_legs;
create policy "bet legs update own" on public.bet_legs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "bet legs delete own" on public.bet_legs;
create policy "bet legs delete own" on public.bet_legs for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "transactions select own" on public.transactions;
create policy "transactions select own" on public.transactions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "transactions insert own" on public.transactions;
create policy "transactions insert own" on public.transactions for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "transactions update own" on public.transactions;
create policy "transactions update own" on public.transactions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "transactions delete own" on public.transactions;
create policy "transactions delete own" on public.transactions for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "snapshots select own" on public.bankroll_snapshots;
create policy "snapshots select own" on public.bankroll_snapshots for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "snapshots insert own" on public.bankroll_snapshots;
create policy "snapshots insert own" on public.bankroll_snapshots for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "snapshots update own" on public.bankroll_snapshots;
create policy "snapshots update own" on public.bankroll_snapshots for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "snapshots delete own" on public.bankroll_snapshots;
create policy "snapshots delete own" on public.bankroll_snapshots for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "limits select own" on public.limits;
create policy "limits select own" on public.limits for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "limits insert own" on public.limits;
create policy "limits insert own" on public.limits for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "limits update own" on public.limits;
create policy "limits update own" on public.limits for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "limits delete own" on public.limits;
create policy "limits delete own" on public.limits for delete to authenticated using (user_id = (select auth.uid()));

-- Automatically create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, initial_bankroll, currency)
  values (new.id, 0, 'INR') on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- NOTE: bet_legs, limits and snapshots are schema-ready; their advanced UI/automation
-- can be added in a follow-up. Never disable RLS to make the client work.
