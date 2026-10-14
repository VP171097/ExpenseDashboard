-- SpendCop cloud storage: one private row per user holding their SpendCop data.
-- Row-level security means each signed-in user can only ever read or change their own row.

create table if not exists public.tally_data (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  rev        bigint not null default 1 check (rev > 0),
  device     text,
  updated_at timestamptz not null default now()
);

alter table public.tally_data enable row level security;

drop policy if exists "Users read their own data" on public.tally_data;
drop policy if exists "Users add their own data" on public.tally_data;
drop policy if exists "Users change their own data" on public.tally_data;
drop policy if exists "Users delete their own data" on public.tally_data;
create policy "Users read their own data" on public.tally_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own data" on public.tally_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their own data" on public.tally_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own data" on public.tally_data for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.tally_data from anon;
grant select, insert, update, delete on public.tally_data to authenticated;

-- Save only if nobody saved in between (another phone or browser), so one device can never
-- silently overwrite another's changes. Returns the new revision, or -1 if the cloud copy
-- changed since p_expected (the app then asks which copy to keep).
create or replace function public.tally_save(p_data jsonb, p_expected bigint, p_device text)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_rev bigint;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_expected = 0 then
    insert into public.tally_data (user_id, data, rev, device)
    values (auth.uid(), p_data, 1, p_device)
    on conflict (user_id) do nothing
    returning rev into new_rev;
  else
    update public.tally_data
       set data = p_data, rev = rev + 1, device = p_device, updated_at = now()
     where user_id = auth.uid() and rev = p_expected
    returning rev into new_rev;
  end if;
  return coalesce(new_rev, -1);
end;
$$;

revoke execute on function public.tally_save(jsonb, bigint, text) from public, anon;
grant execute on function public.tally_save(jsonb, bigint, text) to authenticated;
