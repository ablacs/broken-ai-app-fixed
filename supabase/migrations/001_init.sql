-- Profiles hold the plan; notes are what the user writes.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_pro boolean not null default false,
  stripe_customer_id text
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index notes_user_id_idx on public.notes (user_id);

alter table public.profiles enable row level security;
alter table public.notes enable row level security;

create policy "Users read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users read their own notes"
  on public.notes for select
  using (auth.uid() = id);

create policy "Users add their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

-- Create a profile row for every new account.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
