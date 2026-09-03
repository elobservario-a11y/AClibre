-- ====================================================================
-- Migración 0003: Tabla inmutable de logs de moderación y permisos
-- ====================================================================

create table if not exists public.moderacion_logs (
    id uuid primary key default gen_random_uuid(),
    incidencia_id uuid not null references public.incidencias(id) on delete cascade,
    moderador_id uuid references auth.users(id),
    decision text not null check (decision in ('aprobado', 'retocado', 'rechazado')),
    motivo text,
    estado_anterior text not null,
    creado_en timestamptz not null default now()
);

create index if not exists idx_moderacion_logs_incidencia on public.moderacion_logs(incidencia_id);
create index if not exists idx_moderacion_logs_creado on public.moderacion_logs(creado_en desc);

alter table public.moderacion_logs enable row level security;

-- Solo lectura y escritura por el moderador identificado o service_role
create policy "Moderador puede gestionar logs" on public.moderacion_logs
    for all
    to authenticated
    using (auth.jwt() ->> 'email' = 'info@slowvan.com')
    with check (auth.jwt() ->> 'email' = 'info@slowvan.com');

-- Permitir al moderador actualizar el estado_moderacion de incidencias
create policy "Moderador puede actualizar incidencias" on public.incidencias
    for update
    to authenticated
    using (auth.jwt() ->> 'email' = 'info@slowvan.com')
    with check (auth.jwt() ->> 'email' = 'info@slowvan.com');

-- Permitir al moderador leer incidencias pendientes
create policy "Moderador puede leer todas las incidencias" on public.incidencias
    for select
    to authenticated
    using (auth.jwt() ->> 'email' = 'info@slowvan.com');

-- Permitir al moderador actualizar evidencias retocadas
create policy "Moderador puede actualizar evidencias" on public.evidencias
    for update
    to authenticated
    using (auth.jwt() ->> 'email' = 'info@slowvan.com')
    with check (auth.jwt() ->> 'email' = 'info@slowvan.com');
