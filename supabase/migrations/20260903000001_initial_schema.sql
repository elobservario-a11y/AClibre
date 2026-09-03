-- ====================================================================
-- Migración Maestra 0001: Esquema Inicial de la Plataforma
-- Protocolo: ES-MU-{INE}-{TIPO}-{AÑO}-{SECUENCIAL}
-- Licencia: AGPL-3.0
-- ====================================================================

-- Extensiones requeridas
create extension if not exists "postgis";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- --------------------------------------------------------------------
-- Control de secuencias del Protocolo
-- --------------------------------------------------------------------
create table if not exists public.protocolo_secuencias (
    codigo_ine varchar(5) not null,
    tipo varchar(3) not null check (tipo in ('NOR', 'INC', 'EVI', 'CAS', 'ACC', 'RES')),
    anio integer not null,
    ultimo_valor integer not null default 0,
    primary key (codigo_ine, tipo, anio)
);

-- Función determinista y transaccional de asignación de Protocol ID
create or replace function public.generar_protocol_id(p_ine varchar(5), p_tipo varchar(3))
returns text as $$
declare
    v_anio integer := extract(year from current_date);
    v_seq integer;
begin
    insert into public.protocolo_secuencias (codigo_ine, tipo, anio, ultimo_valor)
    values (p_ine, p_tipo, v_anio, 1)
    on conflict (codigo_ine, tipo, anio)
    do update set ultimo_valor = public.protocolo_secuencias.ultimo_valor + 1
    returning ultimo_valor into v_seq;

    return format('ES-MU-%s-%s-%s-%s', p_ine, p_tipo, v_anio, lpad(v_seq::text, 3, '0'));
end;
$$ language plpgsql volatile;

-- --------------------------------------------------------------------
-- 1. MUNICIPIOS (Dataset INE precargado)
-- --------------------------------------------------------------------
create table if not exists public.municipios (
    id serial primary key,
    codigo_ine varchar(5) unique not null,
    nombre text not null,
    provincia text not null,
    comunidad text not null,
    poblacion integer,
    geom geography(Point, 4326) not null
);

create index if not exists idx_municipios_geom on public.municipios using gist(geom);
create index if not exists idx_municipios_nombre_trgm on public.municipios using gin (nombre gin_trgm_ops);
create index if not exists idx_municipios_provincia on public.municipios(provincia);

-- --------------------------------------------------------------------
-- 2. FUENTES (Catálogo de boletines provinciales y sedes)
-- --------------------------------------------------------------------
create table if not exists public.fuentes (
    id serial primary key,
    provincia text not null,
    tipo text not null check (tipo in ('rss', 'json', 'pdf_fijo', 'html')),
    url_base text not null,
    activo boolean not null default false,
    ultimo_escaneo timestamptz,
    creado_en timestamptz not null default now()
);

-- --------------------------------------------------------------------
-- 3. PUBLICACIONES (Registro inmutable de anuncios capturados)
-- --------------------------------------------------------------------
create table if not exists public.publicaciones (
    id uuid primary key default gen_random_uuid(),
    fuente_id integer references public.fuentes(id),
    fecha_boletin date not null,
    titulo text not null,
    url_origen text not null,
    hash_sha256 char(64) unique not null,
    texto_extraido text,
    necesita_ocr boolean not null default false,
    revisado_prefiltro boolean not null default false,
    creado_en timestamptz not null default now()
);

create index if not exists idx_publicaciones_fecha on public.publicaciones(fecha_boletin desc);
create index if not exists idx_publicaciones_prefiltro on public.publicaciones(revisado_prefiltro) where not revisado_prefiltro;

-- --------------------------------------------------------------------
-- 4. NORMAS (Ordenanzas municipales detectadas o cargadas)
-- --------------------------------------------------------------------
create table if not exists public.normas (
    id uuid primary key default gen_random_uuid(),
    protocol_id text unique not null,
    municipio_id integer not null references public.municipios(id),
    tipo text not null check (tipo in ('circulacion', 'convivencia', 'costas', 'medioambiente')),
    estado text not null check (estado in ('informacion_publica', 'vigente', 'derogada')),
    plazo_alegaciones_hasta date,
    url_publicacion text,
    creado_en timestamptz not null default now()
);

create index if not exists idx_normas_municipio on public.normas(municipio_id);
create index if not exists idx_normas_plazo on public.normas(plazo_alegaciones_hasta) where estado = 'informacion_publica';

-- --------------------------------------------------------------------
-- 5. HALLAZGOS (Análisis estructurado de artículos problemáticos)
-- --------------------------------------------------------------------
create table if not exists public.hallazgos (
    id uuid primary key default gen_random_uuid(),
    norma_id uuid not null references public.normas(id) on delete cascade,
    articulo text not null,
    cita_literal text not null,
    tipo_restriccion text not null check (tipo_restriccion in ('altura', 'longitud', 'mma', 'pernocta', 'galibo_fisico', 'termino_completo')),
    fundamento_ilegalidad text not null,
    confianza_ia float check (confianza_ia between 0 and 1),
    verificado boolean not null default false,
    creado_en timestamptz not null default now()
);

create index if not exists idx_hallazgos_norma on public.hallazgos(norma_id);

-- --------------------------------------------------------------------
-- 6. INCIDENCIAS (Reportes ciudadanos)
-- --------------------------------------------------------------------
create table if not exists public.incidencias (
    id uuid primary key default gen_random_uuid(),
    protocol_id text unique not null,
    municipio_id integer not null references public.municipios(id),
    usuario_id uuid references auth.users(id),
    tipo text not null check (tipo in ('senal_ilegal', 'multa', 'desalojo', 'bloqueo_acceso')),
    descripcion text not null,
    geom geography(Point, 4326) not null,
    geom_publica geography(Point, 4326) not null,
    nivel_confianza integer not null check (nivel_confianza between 1 and 5) default 1,
    estado_moderacion text not null check (estado_moderacion in ('pendiente', 'aprobado', 'rechazado')) default 'pendiente',
    motivo_moderacion text,
    moderado_por uuid references auth.users(id),
    moderado_en timestamptz,
    creado_en timestamptz not null default now()
);

create index if not exists idx_incidencias_geom_pub on public.incidencias using gist(geom_publica);
create index if not exists idx_incidencias_municipio on public.incidencias(municipio_id);
create index if not exists idx_incidencias_moderacion on public.incidencias(estado_moderacion);

-- --------------------------------------------------------------------
-- 7. EVIDENCIAS (Fotografías y documentos sin EXIF)
-- --------------------------------------------------------------------
create table if not exists public.evidencias (
    id uuid primary key default gen_random_uuid(),
    protocol_id text unique not null,
    incidencia_id uuid not null references public.incidencias(id) on delete cascade,
    url_storage text not null,
    hash_sha256 char(64) not null,
    creado_en timestamptz not null default now()
);

create index if not exists idx_evidencias_incidencia on public.evidencias(incidencia_id);

-- --------------------------------------------------------------------
-- 8. CASOS (Unidades estratégicas de coordinación)
-- --------------------------------------------------------------------
create table if not exists public.casos (
    id uuid primary key default gen_random_uuid(),
    protocol_id text unique not null,
    municipio_id integer not null references public.municipios(id),
    titulo text not null,
    descripcion text,
    nivel_verificacion integer not null check (nivel_verificacion between 1 and 5) default 1,
    potencial_estrategico integer not null check (potencial_estrategico between 1 and 10) default 1,
    es_campana boolean not null default false,
    es_semilla boolean not null default false,
    creado_en timestamptz not null default now()
);

create index if not exists idx_casos_municipio on public.casos(municipio_id);

-- --------------------------------------------------------------------
-- 9. ACCIONES (Escritos generados y presentados por ciudadanos)
-- --------------------------------------------------------------------
create table if not exists public.acciones (
    id uuid primary key default gen_random_uuid(),
    protocol_id text unique not null,
    caso_id uuid references public.casos(id) on delete cascade,
    municipio_id integer not null references public.municipios(id),
    usuario_id uuid references auth.users(id),
    tipo text not null check (tipo in ('alegacion_ordenanza', 'solicitud_expediente_senal', 'recurso_multa', 'reclamacion_previa')),
    fecha_presentacion date not null,
    plazo_limite date,
    estado text not null check (estado in ('borrador', 'presentada', 'respondida', 'vencida')) default 'borrador',
    hash_envio char(64),
    creado_en timestamptz not null default now()
);

create index if not exists idx_acciones_usuario on public.acciones(usuario_id);

-- --------------------------------------------------------------------
-- 10. RESULTADOS (Memoria operacional y desenlace de expedientes)
-- --------------------------------------------------------------------
create table if not exists public.resultados (
    id uuid primary key default gen_random_uuid(),
    protocol_id text unique not null,
    accion_id uuid references public.acciones(id) on delete set null,
    municipio_id integer not null references public.municipios(id),
    tipo_accion text not null check (tipo_accion in ('alegacion_ordenanza', 'solicitud_expediente_senal', 'recurso_multa', 'reclamacion_previa')),
    estrategia_usada text not null,
    fecha_presentacion date not null,
    fecha_respuesta date,
    resultado text check (resultado in ('estimado', 'desestimado', 'silencio_administrativo', 'estimado_parcial')),
    duracion_dias integer generated always as (
        case when fecha_respuesta is not null then (fecha_respuesta - fecha_presentacion) else null end
    ) stored,
    observaciones text,
    creado_en timestamptz not null default now()
);

create index if not exists idx_resultados_municipio on public.resultados(municipio_id);
create index if not exists idx_resultados_estrategia on public.resultados(estrategia_usada);

-- --------------------------------------------------------------------
-- 11. ESTRATEGIAS (Catálogo tipificado para la memoria colectiva)
-- --------------------------------------------------------------------
create table if not exists public.estrategias (
    id serial primary key,
    nombre text unique not null,
    descripcion text,
    tipo_caso text not null,
    activo boolean not null default true,
    creado_en timestamptz not null default now()
);

-- --------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- --------------------------------------------------------------------
alter table public.municipios enable row level security;
alter table public.fuentes enable row level security;
alter table public.publicaciones enable row level security;
alter table public.normas enable row level security;
alter table public.hallazgos enable row level security;
alter table public.incidencias enable row level security;
alter table public.evidencias enable row level security;
alter table public.casos enable row level security;
alter table public.acciones enable row level security;
alter table public.resultados enable row level security;
alter table public.estrategias enable row level security;

-- Políticas de lectura pública
create policy "Municipios son públicos" on public.municipios for select using (true);
create policy "Fuentes son públicas" on public.fuentes for select using (true);
create policy "Publicaciones son públicas" on public.publicaciones for select using (true);
create policy "Normas son públicas" on public.normas for select using (true);
create policy "Hallazgos son públicos" on public.hallazgos for select using (true);
create policy "Casos son públicos" on public.casos for select using (true);
create policy "Resultados son públicos" on public.resultados for select using (true);
create policy "Estrategias son públicas" on public.estrategias for select using (true);

-- Políticas para incidencias
create policy "Incidencias aprobadas son públicas" on public.incidencias
    for select using (estado_moderacion = 'aprobado');

create policy "Usuarios ven sus propias incidencias" on public.incidencias
    for select using (auth.uid() = usuario_id);

create policy "Usuarios autenticados pueden reportar incidencias" on public.incidencias
    for insert with check (auth.uid() = usuario_id);

-- Políticas para evidencias
create policy "Evidencias de incidencias aprobadas son públicas" on public.evidencias
    for select using (
        exists (
            select 1 from public.incidencias
            where incidencias.id = evidencias.incidencia_id
            and incidencias.estado_moderacion = 'aprobado'
        )
    );

create policy "Usuarios pueden adjuntar evidencias a sus incidencias" on public.evidencias
    for insert with check (
        exists (
            select 1 from public.incidencias
            where incidencias.id = evidencias.incidencia_id
            and incidencias.usuario_id = auth.uid()
        )
    );

-- Políticas para acciones
create policy "Usuarios ven y gestionan sus propias acciones" on public.acciones
    for all using (auth.uid() = usuario_id);
