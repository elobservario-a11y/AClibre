-- Migration 0010: Security hardening (P1.1, P1.2, P1.3, P0.5, P1.4)

-- 1. Vista pública segura de incidencias (solo expone geom_publica)
CREATE OR REPLACE VIEW public.incidencias_publicas AS
SELECT 
  i.id,
  i.protocol_id,
  i.municipio_id,
  m.codigo_ine,
  m.nombre AS municipio_nombre,
  m.provincia AS municipio_provincia,
  m.comunidad AS municipio_comunidad,
  i.tipo,
  i.descripcion,
  i.geom_publica,
  i.nivel_confianza,
  i.estado_moderacion,
  i.creado_en,
  i.fuente_federacion,
  i.url_evidencia_externa
FROM public.incidencias i
JOIN public.municipios m ON m.id = i.municipio_id
WHERE i.estado_moderacion = 'aprobado';

GRANT SELECT ON public.incidencias_publicas TO anon, authenticated;

-- Revocar select público sobre tabla base incidencias (solo moderador o propietario)
DO $$ 
DECLARE 
  pol RECORD; 
BEGIN 
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'incidencias' AND policyname ILIKE '%aprobadas%' 
  LOOP 
    EXECUTE format('DROP POLICY %I ON public.incidencias', pol.policyname); 
  END LOOP; 
END $$;

-- 2. Endurecer suscripciones_alertas (eliminar UPDATE público arbitrario)
DROP POLICY IF EXISTS "Baja mediante token" ON public.suscripciones_alertas;

CREATE OR REPLACE FUNCTION public.cancelar_suscripcion_alerta(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN false;
  END IF;

  UPDATE public.suscripciones_alertas
  SET activa = false
  WHERE token_baja = trim(p_token) AND activa = true;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_suscripcion_alerta(text) TO anon, authenticated;

-- 3. Endurecer moderacion_logs (hacer inmutable: solo INSERT y SELECT, nunca UPDATE o DELETE)
DROP POLICY IF EXISTS "Moderador puede gestionar logs" ON public.moderacion_logs;

CREATE POLICY "Moderador puede ver logs" ON public.moderacion_logs
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@slowvan.com');

CREATE POLICY "Moderador puede insertar logs" ON public.moderacion_logs
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@slowvan.com');

-- 4. Tabla de tokens de federación
CREATE TABLE IF NOT EXISTS public.federation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  nombre_nodo text NOT NULL,
  nivel_confianza integer NOT NULL DEFAULT 2,
  rate_limit_hora integer NOT NULL DEFAULT 20,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.federation_tokens ENABLE ROW LEVEL SECURITY;

INSERT INTO public.federation_tokens (token, nombre_nodo, nivel_confianza, rate_limit_hora, activo)
VALUES ('tok_slowvan_test', 'Slowvan Test Node', 2, 20, true)
ON CONFLICT (token) DO UPDATE SET activo = true;
