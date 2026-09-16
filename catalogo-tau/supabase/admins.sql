-- Ejecutar en Supabase SQL Editor.
-- La tabla admins funciona como lista de correos autorizados;
-- las cuentas reales siguen viviendo en Supabase Auth (auth.users).

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  fecha_alta timestamptz not null default now()
);

alter table public.admins enable row level security;

create or replace function public.es_admin_actual()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

revoke all on function public.es_admin_actual() from public;
grant execute on function public.es_admin_actual() to authenticated;

drop policy if exists "admins_select_authorized" on public.admins;
drop policy if exists "admins_insert_authorized" on public.admins;
drop policy if exists "admins_update_authorized" on public.admins;
drop policy if exists "admins_delete_authorized" on public.admins;

create policy "admins_select_authorized"
on public.admins for select to authenticated
using (public.es_admin_actual());

create policy "admins_insert_authorized"
on public.admins for insert to authenticated
with check (public.es_admin_actual());

create policy "admins_update_authorized"
on public.admins for update to authenticated
using (public.es_admin_actual())
with check (public.es_admin_actual());

create policy "admins_delete_authorized"
on public.admins for delete to authenticated
using (public.es_admin_actual());

insert into public.admins (email)
values ('admin@tau.coop.ar')
on conflict (email) do nothing;
