import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Tokens estáticos de nodos federados. En producción: mover a tabla federation_tokens en BD.
const FEDERATION_TOKENS: Record<string, { nombre: string; nivel_confianza: number; rate_limit: number }> = {
  'tok_park4night_2026': { nombre: 'Park4Night', nivel_confianza: 4, rate_limit: 500 },
  'tok_caramaps_2026':   { nombre: 'Caramaps',   nivel_confianza: 4, rate_limit: 500 },
  'tok_feaa_2026':       { nombre: 'FEAA',        nivel_confianza: 3, rate_limit: 100 },
  'tok_slowvan_test':    { nombre: 'Test Slowvan', nivel_confianza: 2, rate_limit: 20  },
}

const TIPOS_VALIDOS = ['senal_ilegal', 'multa', 'desalojo', 'bloqueo_acceso']

// Bounding box peninsular + Baleares (excluyendo Canarias para simplificar)
const SPAIN_BOUNDS = { minLat: 35.0, maxLat: 44.5, minLon: -9.5, maxLon: 4.5 }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { federation_token, fuente_nombre, tipo, descripcion, lat, lon, nivel_confianza, url_evidencia } = body

    // 1. Validar token de federación
    const nodo = FEDERATION_TOKENS[federation_token]
    if (!nodo) {
      return NextResponse.json({ error: 'Token de federación inválido o no reconocido' }, { status: 400 })
    }

    // 2. Validar tipo canónico
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: `Tipo no válido. Valores aceptados: ${TIPOS_VALIDOS.join(', ')}` }, { status: 400 })
    }

    // 3. Validar descripción
    if (!descripcion || descripcion.trim().length < 20) {
      return NextResponse.json({ error: 'La descripción debe tener al menos 20 caracteres' }, { status: 400 })
    }

    // 4. Validar coordenadas (territorio español peninsular + Baleares)
    const latNum = parseFloat(lat)
    const lonNum = parseFloat(lon)
    if (
      isNaN(latNum) || isNaN(lonNum) ||
      latNum < SPAIN_BOUNDS.minLat || latNum > SPAIN_BOUNDS.maxLat ||
      lonNum < SPAIN_BOUNDS.minLon || lonNum > SPAIN_BOUNDS.maxLon
    ) {
      return NextResponse.json({
        error: `Coordenadas fuera del territorio cubierto. Bounds: lat [${SPAIN_BOUNDS.minLat}, ${SPAIN_BOUNDS.maxLat}], lon [${SPAIN_BOUNDS.minLon}, ${SPAIN_BOUNDS.maxLon}]`
      }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 5. Buscar municipio más cercano por coordenadas
    const { data: municipios, error: muniErr } = await supabase.rpc('municipio_mas_cercano', {
      p_lat: latNum,
      p_lon: lonNum,
    })

    if (muniErr || !municipios || municipios.length === 0) {
      return NextResponse.json({ error: 'No se encontró municipio en las coordenadas indicadas' }, { status: 400 })
    }

    const municipio = municipios[0]

    // 6. Comprobar duplicados en ±100m y mismo tipo en las últimas 24h
    const { data: duplicado } = await supabase.rpc('incidencia_duplicada_cercana', {
      p_lat: latNum,
      p_lon: lonNum,
      p_tipo: tipo,
      p_horas: 24,
    })

    if (duplicado) {
      return NextResponse.json({ error: 'Incidencia duplicada: ya existe un reporte del mismo tipo en ±100m en las últimas 24h' }, { status: 409 })
    }

    // 7. Generar protocol_id
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('incidencias')
      .select('*', { count: 'exact', head: true })
      .eq('municipio_id', municipio.id)

    const seq = String((count || 0) + 1).padStart(3, '0')
    const protocolId = `ES-MU-${municipio.codigo_ine}-INC-${year}-${seq}`

    // 8. Crear incidencia en cola de moderación
    const nivelFinal = nivel_confianza
      ? Math.min(Math.max(parseInt(nivel_confianza), 1), nodo.nivel_confianza)
      : nodo.nivel_confianza

    const { error: insertErr } = await supabase.from('incidencias').insert({
      protocol_id: protocolId,
      municipio_id: municipio.id,
      tipo,
      descripcion: descripcion.trim(),
      geom: `SRID=4326;POINT(${lonNum} ${latNum})`,
      geom_publica: `SRID=4326;POINT(${lonNum} ${latNum})`,
      nivel_confianza: nivelFinal,
      estado_moderacion: 'pendiente',
      motivo_moderacion: `Reporte federado recibido de ${nodo.nombre}`,
      fuente_federacion: nodo.nombre,
      url_evidencia_externa: url_evidencia || null,
    })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        status: 'created',
        protocol_id: protocolId,
        message: 'Reporte federado registrado en cola de moderación',
        fuente: nodo.nombre,
        municipio: municipio.nombre,
      },
      { status: 201 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
