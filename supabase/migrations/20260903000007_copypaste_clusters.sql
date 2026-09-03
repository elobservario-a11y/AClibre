-- ====================================================================
-- Migración 0007: Detección de copypaste y clústeres de contagio normativo
-- ====================================================================

create table if not exists public.similitudes_normas (
    id uuid primary key default gen_random_uuid(),
    norma_a_id uuid not null references public.normas(id) on delete cascade,
    norma_b_id uuid not null references public.normas(id) on delete cascade,
    municipio_a_id integer not null references public.municipios(id) on delete cascade,
    municipio_b_id integer not null references public.municipios(id) on delete cascade,
    porcentaje_similitud numeric(5,2) not null,
    fragmentos_coincidentes jsonb not null default '[]'::jsonb,
    posible_redactor text,
    detectado_en timestamptz not null default now(),
    constraint unique_similitud_pair unique (norma_a_id, norma_b_id),
    constraint check_different_normas check (norma_a_id != norma_b_id)
);

create index if not exists idx_similitudes_muni_a on public.similitudes_normas(municipio_a_id);
create index if not exists idx_similitudes_muni_b on public.similitudes_normas(municipio_b_id);
create index if not exists idx_similitudes_score on public.similitudes_normas(porcentaje_similitud desc);

alter table public.similitudes_normas enable row level security;

create policy "Lectura pública de clústeres de similitud" on public.similitudes_normas
    for select
    to public
    using (true);

create policy "Service role gestiona clústeres" on public.similitudes_normas
    for all
    to service_role
    using (true);
