-- ====================================================================
-- Migración 0005: Sistema de Suscripciones y Registro de Alertas por Correo
-- ====================================================================

create table if not exists public.suscripciones_alertas (
    id uuid primary key default gen_random_uuid(),
    email text not null check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    municipio_id integer references public.municipios(id) on delete cascade,
    provincia text,
    activa boolean not null default true,
    token_baja text not null unique default encode(gen_random_bytes(16), 'hex'),
    creado_en timestamptz not null default now()
);

create index if not exists idx_suscripciones_email on public.suscripciones_alertas(email);
create index if not exists idx_suscripciones_muni on public.suscripciones_alertas(municipio_id);
create index if not exists idx_suscripciones_prov on public.suscripciones_alertas(provincia);

create table if not exists public.alertas_enviadas (
    id uuid primary key default gen_random_uuid(),
    norma_id uuid not null references public.normas(id) on delete cascade,
    suscripcion_id uuid not null references public.suscripciones_alertas(id) on delete cascade,
    enviado_en timestamptz not null default now()
);

create index if not exists idx_alertas_norma_suscripcion on public.alertas_enviadas(norma_id, suscripcion_id);

alter table public.suscripciones_alertas enable row level security;
alter table public.alertas_enviadas enable row level security;

-- Cualquiera puede suscribirse (insert)
create policy "Cualquiera puede suscribirse a alertas" on public.suscripciones_alertas
    for insert
    to public
    with check (true);

-- Permite consultar por token de baja
create policy "Baja mediante token" on public.suscripciones_alertas
    for update
    to public
    using (true)
    with check (true);

-- Service role y admin gestionan todo
create policy "Admin gestiona suscripciones" on public.suscripciones_alertas
    for all
    to service_role
    using (true);

create policy "Admin gestiona alertas enviadas" on public.alertas_enviadas
    for all
    to service_role
    using (true);
