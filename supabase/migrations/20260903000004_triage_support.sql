-- ====================================================================
-- Migración 0004: Soporte para Triaje de Publicaciones (Haiku)
-- ====================================================================

alter table public.publicaciones
    add column if not exists resultado_triaje jsonb,
    add column if not exists afecta_caravaning boolean default false,
    add column if not exists tipo_acto text check (tipo_acto in ('aprobacion_inicial', 'informacion_publica', 'aprobacion_definitiva', 'derogacion', 'otro')),
    add column if not exists confianza_triaje float check (confianza_triaje between 0 and 1),
    add column if not exists municipio_detectado_id integer references public.municipios(id),
    add column if not exists estado_triaje text check (estado_triaje in ('pendiente', 'procesado', 'ascendido', 'descartado')) default 'pendiente',
    add column if not exists triado_en timestamptz;

create index if not exists idx_publicaciones_estado_triaje on public.publicaciones(estado_triaje);
create index if not exists idx_publicaciones_afecta on public.publicaciones(afecta_caravaning) where afecta_caravaning;
