-- ====================================================================
-- Test de Verificación: Protocol IDs y Estructura DDL
-- ====================================================================

do $$
declare
    v_id1 text;
    v_id2 text;
    v_id_inc text;
    v_id_madrid text;
    v_expected_anio text := extract(year from current_date)::text;
    v_muni_id integer;
    v_norma_id uuid;
begin
    -- 1. Test generación básica
    v_id1 := public.generar_protocol_id('13028', 'NOR');
    if v_id1 != format('ES-MU-13028-NOR-%s-001', v_expected_anio) then
        raise exception 'Fallo en v_id1: esperado ES-MU-13028-NOR-%-001, obtenido %', v_expected_anio, v_id1;
    end if;

    -- 2. Test correlativo en mismo tipo y municipio
    v_id2 := public.generar_protocol_id('13028', 'NOR');
    if v_id2 != format('ES-MU-13028-NOR-%s-002', v_expected_anio) then
        raise exception 'Fallo en v_id2: esperado ES-MU-13028-NOR-%-002, obtenido %', v_expected_anio, v_id2;
    end if;

    -- 3. Test independencia de secuencia por tipo
    v_id_inc := public.generar_protocol_id('13028', 'INC');
    if v_id_inc != format('ES-MU-13028-INC-%s-001', v_expected_anio) then
        raise exception 'Fallo en v_id_inc: esperado ES-MU-13028-INC-%-001, obtenido %', v_expected_anio, v_id_inc;
    end if;

    -- 4. Test independencia de secuencia por municipio
    v_id_madrid := public.generar_protocol_id('28079', 'NOR');
    if v_id_madrid != format('ES-MU-28079-NOR-%s-001', v_expected_anio) then
        raise exception 'Fallo en v_id_madrid: esperado ES-MU-28079-NOR-%-001, obtenido %', v_expected_anio, v_id_madrid;
    end if;

    -- 5. Test integridad referencial: insertar municipio dummy
    insert into public.municipios (codigo_ine, nombre, provincia, comunidad, poblacion, geom)
    values ('13028', 'Daimiel', 'Ciudad Real', 'Castilla-La Mancha', 17929, ST_SetSRID(ST_MakePoint(-3.6136, 39.0697), 4326)::geography)
    returning id into v_muni_id;

    -- 6. Insertar norma con el ID generado
    insert into public.normas (protocol_id, municipio_id, tipo, estado, plazo_alegaciones_hasta)
    values (v_id1, v_muni_id, 'circulacion', 'informacion_publica', current_date + interval '30 days')
    returning id into v_norma_id;

    -- 7. Insertar hallazgo sobre la norma
    insert into public.hallazgos (norma_id, articulo, cita_literal, tipo_restriccion, fundamento_ilegalidad, confianza_ia)
    values (v_norma_id, 'Art. 22', 'Prohibido el estacionamiento de autocaravanas de más de 5 metros en todo el término municipal', 'longitud', 'Contrario a la Instrucción 08/V-74 y competencia municipal sobre tráfico', 0.95);

    -- Limpieza de datos de test
    rollback;
    raise notice '>> TEST PROTOCOL ID Y DDL SUPERADO EXITOSAMENTE <<';
end;
$$;
