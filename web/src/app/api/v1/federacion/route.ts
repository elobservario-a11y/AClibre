import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { obfuscateCoords } from '@/lib/geo'

const TIPOS_VALIDOS = ['senal_ilegal', 'multa', 'desalojo', 'bloqueo_acceso']
const SPAIN_BOUNDS = { minLat: 35.0, maxLat: 44.5, minLon: -9.5, maxLon: 4.5 }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { federation_token, tipo, descripcion, lat, lon, nivel_confianza, url_evidencia } = body

    if (!federation_token || typeof federation_token !== 'string') {
      return NextResponse.json({ error: 'Falta token de federación' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Validar token contra la tabla federation_tokens en base de datos
    const { data: nodo, error: tokenErr } = await supabase
      .from('federation_tokens')
      .select('token, nombre_nodo, nivel_confianza, rate_limit_hora, activo')
      .eq('token', federation_token.trim())
      .eq('activo', true)
      .single()

    if (tokenErr || !nodo) {
      return NextResponse.json({ error: 'Token de federación inválido, inactivo o no reconocido' }, { status: 400 })
    }

    // 2. Control de rate limit real por nodo en la última hora
    const { count: reportesHora } = await supabase
      .from('incidencias')
      .select('*', { count: 'exact', head: true })
      .eq('fuente_federacion', nodo.nombre_nodo)
      .gte('creado_en', new Date(Date.now() - 60 * 60 * 1000).toISOString())

    if ((reportesHora || 0) >= nodo.rate_limit_hora) {
      return NextResponse.json({ error: 'Límite de peticiones por hora excedido para este nodo' }, { status: 429 })
    }

    // 3. Validar tipo canónico
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: `Tipo no válido. Valores aceptados: ${TIPOS_VALIDOS.join(', ')}` }, { status: 400 })
    }

    // 4. Validar descripción
    if (!descripcion || typeof descripcion !== 'string' || descripcion.trim().length < 20) {
      return NextResponse.json({ error: 'La descripción debe tener al menos 20 caracteres' }, { status: 400 })
    }

    // 5. Validar coordenadas
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

    // 6. Buscar municipio más cercano por coordenadas
    const { data: municipios, error: muniErr } = await supabase.rpc('municipio_mas_cercano', {
      p_lat: latNum,
      p_lon: lonNum,
    })

    if (muniErr || !municipios || municipios.length === 0) {
      return NextResponse.json({ error: 'No se encontró municipio en las coordenadas indicadas' }, { status: 400 })
    }

    const municipio = municipios[0]

    // 7. Comprobar duplicados en ±100m y mismo tipo en las últimas 24h
    const { data: duplicado } = await supabase.rpc('incidencia_duplicada_cercana', {
      p_lat: latNum,
      p_lon: lonNum,
      p_tipo: tipo,
      p_horas: 24,
    })

    if (duplicado) {
      return NextResponse.json({ error: 'Incidencia duplicada: ya existe un reporte del mismo tipo en ±100m en las últimas 24h' }, { status: 409 })
    }

    // 8. Generar protocol_id de forma atómica mediante la función de base de datos
    const { data: protocolId, error: rpcErr } = await supabase
      .rpc('generar_protocol_id', { p_ine: municipio.codigo_ine, p_tipo: 'INC' })

    if (rpcErr || !protocolId) {
      return NextResponse.json({ error: 'Error al generar identificador de protocolo' }, { status: 500 })
    }

    // 9. Ofuscación de coordenadas a ~100m para la columna pública
    const pub = obfuscateCoords(latNum, lonNum)

    const nivelFinal = nivel_confianza
      ? Math.min(Math.max(parseInt(nivel_confianza), 1), nodo.nivel_confianza)
      : nodo.nivel_confianza

    const { error: insertErr } = await supabase.from('incidencias').insert({
      protocol_id: protocolId,
      municipio_id: municipio.id,
      tipo,
      descripcion: descripcion.trim(),
      geom: `SRID=4326;POINT(${lonNum} ${latNum})`,
      geom_publica: `SRID=4326;POINT(${pub.lon} ${pub.lat})`,
      nivel_confianza: nivelFinal,
      estado_moderacion: 'pendiente',
      motivo_moderacion: `Reporte federado recibido de ${nodo.nombre_nodo}`,
      fuente_federacion: nodo.nombre_nodo,
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
        fuente: nodo.nombre_nodo,
        municipio: municipio.nombre,
      },
      { status: 201 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
