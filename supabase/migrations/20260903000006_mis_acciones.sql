-- ====================================================================
-- Migración 0006: Mejoras en tabla acciones y políticas para panel de usuario
-- ====================================================================

-- Columnas adicionales para trazabilidad de la presentación y resolución
alter table public.acciones add column if not exists email text;
alter table public.acciones add column if not exists numero_registro text;
alter table public.acciones add column if not exists organismo_destino text;
alter table public.acciones add column if not exists notas text;
alter table public.acciones add column if not exists resultado_tipo text;
alter table public.acciones add column if not exists resultado_en timestamptz;
alter table public.acciones add column if not exists norma_id uuid references public.normas(id) on delete set null;
alter table public.acciones add column if not exists incidencia_id uuid references public.incidencias(id) on delete set null;

-- Actualizar constraints de tipo y estado
alter table public.acciones drop constraint if exists acciones_tipo_check;
alter table public.acciones add constraint acciones_tipo_check check (
    tipo in (
        'alegacion_ordenanza', 'recurso_reposicion', 'solicitud_expediente_senal',
        'recurso_multa', 'reclamacion_previa'
    )
);

alter table public.acciones drop constraint if exists acciones_estado_check;
alter table public.acciones add constraint acciones_estado_check check (
    estado in (
        'borrador', 'presentada', 'respondida', 'vencida',
        'estimada', 'desestimada', 'silencio'
    )
);

-- Trigger para calcular automáticamente plazo_limite de respuesta administrativa
create or replace function public.fn_calcular_limite_respuesta()
returns trigger as $$
begin
    if new.fecha_presentacion is not null and new.plazo_limite is null then
        if new.tipo = 'alegacion_ordenanza' then
            -- 3 meses según Art. 83 y 21 LPAC
            new.plazo_limite := new.fecha_presentacion + interval '3 months';
        elsif new.tipo in ('solicitud_expediente_senal', 'recurso_reposicion', 'reclamacion_previa') then
            -- 1 mes según Art. 20 LTBG / Art. 124 LPAC
            new.plazo_limite := new.fecha_presentacion + interval '1 month';
        else
            new.plazo_limite := new.fecha_presentacion + interval '1 month';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_calcular_limite_respuesta on public.acciones;
create trigger trg_calcular_limite_respuesta
    before insert or update on public.acciones
    for each row
    execute function public.fn_calcular_limite_respuesta();
