import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isDev = process.env.NODE_ENV === 'development'
  const isAuthorized = user?.email === 'info@slowvan.com' || isDev
  const adminClient = createAdminClient()
  return { supabase: adminClient, user, isAuthorized }
}

export async function GET() {
  const { supabase, isAuthorized } = await verifyAdmin()
  if (!isAuthorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Obtener publicaciones procesadas por el triaje pendientes de decisión humana
  const { data, error } = await supabase
    .from('publicaciones')
    .select(`
      id,
      titulo,
      url_origen,
      fecha_boletin,
      texto_extraido,
      afecta_caravaning,
      tipo_acto,
      confianza_triaje,
      resultado_triaje,
      estado_triaje,
      municipios:municipio_detectado_id (
        id,
        codigo_ine,
        nombre,
        provincia
      )
    `)
    .in('estado_triaje', ['procesado', 'pendiente'])
    .eq('revisado_prefiltro', true)
    .order('afecta_caravaning', { ascending: false })
    .order('creado_en', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data || [] })
}

export async function POST(request: Request) {
  const { supabase, isAuthorized } = await verifyAdmin()
  if (!isAuthorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { publicacionId, decision, municipioId, tipoNorma, plazoAlegacionesHasta } = body

  if (!publicacionId || !decision) {
    return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 })
  }

  // 1. Obtener la publicación
  const { data: pub, error: pubErr } = await supabase
    .from('publicaciones')
    .select('id, titulo, url_origen, municipio_detectado_id')
    .eq('id', publicacionId)
    .single()

  if (pubErr || !pub) {
    return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })
  }

  // 2. Si se decide ascender a Norma
  if (decision === 'ascender') {
    const finalMuniId = municipioId || pub.municipio_detectado_id
    if (!finalMuniId) {
      return NextResponse.json({ error: 'Se requiere asignar un municipio para ascender a norma' }, { status: 400 })
    }

    // Obtener codigo_ine del municipio
    const { data: muni } = await supabase
      .from('municipios')
      .select('codigo_ine')
      .eq('id', finalMuniId)
      .single()

    if (!muni) {
      return NextResponse.json({ error: 'Municipio inválido' }, { status: 400 })
    }

    // Generar protocol_id para la norma
    const { data: protocolId, error: rpcErr } = await supabase
      .rpc('generar_protocol_id', { p_ine: muni.codigo_ine, p_tipo: 'NOR' })
    if (rpcErr) throw rpcErr

    // Insertar en normas
    const { error: insNormaErr } = await supabase.from('normas').insert({
      protocol_id: protocolId,
      municipio_id: finalMuniId,
      tipo: tipoNorma || 'circulacion',
      estado: plazoAlegacionesHasta ? 'informacion_publica' : 'vigente',
      plazo_alegaciones_hasta: plazoAlegacionesHasta || null,
      url_publicacion: pub.url_origen,
    })

    if (insNormaErr) {
      return NextResponse.json({ error: insNormaErr.message }, { status: 500 })
    }

    // Actualizar publicación a ascendida
    await supabase.from('publicaciones').update({
      estado_triaje: 'ascendido',
      municipio_detectado_id: finalMuniId
    }).eq('id', publicacionId)

    return NextResponse.json({ ok: true, decision: 'ascendido', protocol_id: protocolId })
  }

  // 3. Si se decide descartar
  await supabase.from('publicaciones').update({
    estado_triaje: 'descartado'
  }).eq('id', publicacionId)

  return NextResponse.json({ ok: true, decision: 'descartado' })
}
