-- Migración 0011: Cierre de protocolo_secuencias y hardening de search_path
--
-- Hallazgo (auditoría 2026-09-04, confirmado en producción): la tabla
-- public.protocolo_secuencias quedó con RLS DESACTIVADA y con permisos completos
-- (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) para los roles anon y authenticated.
-- Al estar expuesta por PostgREST, cualquiera con la anon key pública —que va
-- embebida en el frontend— podía leer, alterar o vaciar el secuenciador de
-- protocol_id, provocando colisiones de identificadores y dejando el alta de
-- incidencias inservible.
--
-- No basta con activar RLS: generar_protocol_id() era SECURITY INVOKER y escribe
-- directamente en esa tabla, así que cerrarla sin más habría roto el formulario.
-- La función pasa a SECURITY DEFINER con search_path fijado.

-- 1. La función escribe con los privilegios de su propietario, no del llamante.
create or replace function public.generar_protocol_id(p_ine character varying, p_tipo character varying)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
$function$;

-- 2. Tabla cerrada: RLS activa y sin políticas => solo service_role y el owner.
alter table public.protocolo_secuencias enable row level security;
revoke all on public.protocolo_secuencias from anon, authenticated;

-- 3. Generar IDs solo lo necesitan el formulario (sesión iniciada) y el backend.
--    Postgres concede EXECUTE a PUBLIC por defecto, así que hay que revocar de
--    PUBLIC además de anon: revocar solo de anon no surte ningún efecto.
revoke execute on function public.generar_protocol_id(character varying, character varying) from public;
revoke execute on function public.generar_protocol_id(character varying, character varying) from anon;
grant execute on function public.generar_protocol_id(character varying, character varying) to authenticated, service_role;

-- 4. search_path fijo en el resto de funciones señaladas por el linter (aviso 0011).
alter function public.municipio_mas_cercano(double precision, double precision) set search_path = public, pg_temp;
alter function public.incidencia_duplicada_cercana(double precision, double precision, text, integer) set search_path = public, pg_temp;
alter function public.fn_calcular_limite_respuesta() set search_path = public, pg_temp;
