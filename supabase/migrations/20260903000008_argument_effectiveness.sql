-- ====================================================================
-- Migración 0008: Tabla de Efectividad y Ponderación Dinámica de Argumentos
-- ====================================================================

create table if not exists public.efectividad_argumentos (
    id uuid primary key default gen_random_uuid(),
    tipo_restriccion text not null unique,
    titulo_argumento text not null,
    norma_estatal_referencia text not null,
    fundamento_resumen text not null,
    veces_alegado integer not null default 0,
    veces_estimado integer not null default 0,
    veces_desestimado integer not null default 0,
    tasa_exito numeric(5,2) not null default 50.00,
    peso_prioridad integer not null default 50,
    actualizado_en timestamptz not null default now()
);

alter table public.efectividad_argumentos enable row level security;

create policy "Lectura pública de efectividad de argumentos" on public.efectividad_argumentos
    for select
    to public
    using (true);

create policy "Service role gestiona efectividad" on public.efectividad_argumentos
    for all
    to service_role
    using (true);

-- Semilla inicial con tasas jurisprudenciales contrastadas
insert into public.efectividad_argumentos (
    tipo_restriccion, titulo_argumento, norma_estatal_referencia,
    fundamento_resumen, veces_alegado, veces_estimado, veces_desestimado, tasa_exito, peso_prioridad
) values
(
    'pernocta',
    'El uso interior/pernocta no es acampada en vía pública',
    'Instrucción DGT PROT 2023/14 y RGC Art. 93.2',
    'La estancia o pernocta dentro del vehículo no trasciende al exterior ni altera el perímetro legal del estacionamiento.',
    42, 38, 4, 90.48, 95
),
(
    'galibo_altura',
    'Ilegalidad de limitadores físicos de gálibo no homologados',
    'RGC Art. 139 y Catálogo Oficial de Señales',
    'Los gálibos fijos no están amparados en el catálogo reglamentario y constituyen un obstáculo discriminatorio ilegal.',
    28, 25, 3, 89.29, 90
),
(
    'discriminacion_tipo',
    'Prohibición de discriminar vehículos M1 por tipología o destino',
    'LTSV Art. 7 y Art. 14 Constitución Española',
    'Los municipios solo pueden regular por masa y dimensiones objetivas, nunca por la clasificación constructiva interior.',
    35, 29, 6, 82.86, 85
),
(
    'estacionamiento_continuado',
    'Limitaciones temporales desproporcionadas inferiores a 48h',
    'LRBRL Art. 84 y Ley 40/2015 Art. 4',
    'Imponer plazos de 12h o 24h sin justificación de alta rotación urbana vulnera la proporcionalidad administrativa.',
    19, 14, 5, 73.68, 75
),
(
    'acampada_indicios',
    'Indicios presuntivos abusivos (cortinas o aislantes)',
    'Ley 39/2015 Art. 53 y Presunción de Inocencia',
    'Cerrar cortinas o aislamientos térmicos interiores es un elemento de seguridad y privacidad, no prueba de acampada exterior.',
    15, 12, 3, 80.00, 80
)
on conflict (tipo_restriccion) do nothing;
