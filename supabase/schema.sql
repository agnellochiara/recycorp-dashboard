-- Recycorp · esquema de Supabase (modo backend real; el modo demo no usa esto).
-- Ejecutar en el SQL Editor de un proyecto de Supabase nuevo.

-- 1) Perfiles y rol de administrador -----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Crea automáticamente un perfil (sin privilegios) para cada usuario nuevo de auth.users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Resuelve el rol SIEMPRE en el servidor (nunca confiar en lo que mande el cliente).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Para dar de alta al primer administrador, tras crear su cuenta desde el panel de Supabase:
--   update public.profiles set is_admin = true where id = '<uuid del usuario>';

-- 2) Sedes --------------------------------------------------------------------------------------
create table if not exists public.sites (
  id text primary key,
  name text not null,
  company text not null,
  format text not null default '',
  district text not null default '',
  status text not null default 'Activo' check (status in ('Activo', 'Inactivo'))
);

-- 3) Registros mensuales de residuos -------------------------------------------------------------
create table if not exists public.records (
  id bigserial primary key,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  site text not null references public.sites (id) on delete cascade,
  -- Catálogo de materiales del panel, incluido "madera_nv": dato de referencia que ya forma parte de
  -- "no_aprovechables" y nunca debe sumarse a los totales (ver src/lib/constants.js, MEMO_MATERIALS).
  material text not null check (material in (
    'carton', 'papel', 'pet', 'film', 'plastico_duro', 'vidrio', 'metales', 'mixto',
    'no_aprovechables', 'raee', 'peligrosos', 'organicos', 'madera_nv'
  )),
  treatment text not null check (treatment in ('reciclaje', 'compostaje', 'energetica', 'disposicion')),
  kg numeric not null check (kg >= 0),
  created_at timestamptz not null default now()
);
create index if not exists records_period_idx on public.records (period);
create index if not exists records_site_idx on public.records (site);

-- 4) Configuración (metas, segmentos, factores de emisión) — una sola fila ------------------------
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- 5) RLS: lectura pública (el panel es de solo lectura para cualquiera con el enlace),
--    escritura solo para administradores (resuelto por is_admin(), nunca por el cliente). -------
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.records enable row level security;
alter table public.app_config enable row level security;

create policy "profiles: el propio usuario lee su perfil" on public.profiles for select using (id = auth.uid());

create policy "sites: lectura pública" on public.sites for select using (true);
create policy "sites: escritura solo admin" on public.sites for all using (public.is_admin()) with check (public.is_admin());

create policy "records: lectura pública" on public.records for select using (true);
create policy "records: escritura solo admin" on public.records for all using (public.is_admin()) with check (public.is_admin());

create policy "app_config: lectura pública" on public.app_config for select using (true);
create policy "app_config: escritura solo admin" on public.app_config for all using (public.is_admin()) with check (public.is_admin());

-- 6) Semilla opcional: deja app_config con un valor por defecto si la tabla está vacía.
insert into public.app_config (id, value)
values (1, '{"goals":{"valorizacion":70},"segments":[{"id":"retail","label":"Retail","goal":70},{"id":"educacion","label":"Educación","goal":50},{"id":"hospitalidad","label":"Entretenimiento y hospitalidad","goal":20}],"companySegments":{}}'::jsonb)
on conflict (id) do nothing;
