-- Sprint 5.2: Protocolo de federación
-- Persiste las columnas añadidas en la sesión anterior como migración formal

ALTER TABLE public.incidencias
  ADD COLUMN IF NOT EXISTS fuente_federacion text,
  ADD COLUMN IF NOT EXISTS url_evidencia_externa text;

COMMENT ON COLUMN public.incidencias.fuente_federacion IS 'Nombre del nodo federado que reportó la incidencia (ej: Park4Night, Caramaps, FEAA)';
COMMENT ON COLUMN public.incidencias.url_evidencia_externa IS 'URL pública del reporte original en la plataforma emisora';
-- Sprint 5.2: Funciones SQL de apoyo al endpoint de federaciÃ³n
-- FunciÃ³n 1: Buscar municipio mÃ¡s cercano a unas coordenadas
CREATE OR REPLACE FUNCTION public.municipio_mas_cercano(p_lat float, p_lon float)
RETURNS TABLE(id integer, codigo_ine text, nombre text, provincia text, distancia_m float)
LANGUAGE sql STABLE AS $$
  SELECT m.id, m.codigo_ine::text, m.nombre, m.provincia,
         ST_Distance(m.geom::geography, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography) AS distancia_m
  FROM public.municipios m
  ORDER BY distancia_m ASC
  LIMIT 1;
$$;

-- FunciÃ³n 2: Detectar incidencia duplicada en radio de 100m en las Ãºltimas N horas
CREATE OR REPLACE FUNCTION public.incidencia_duplicada_cercana(p_lat float, p_lon float, p_tipo text, p_horas int DEFAULT 24)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.incidencias i
    WHERE i.tipo = p_tipo
      AND i.creado_en > now() - (p_horas || ' hours')::interval
      AND ST_DWithin(
            i.geom::geography,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
            100
          )
  );
$$;
