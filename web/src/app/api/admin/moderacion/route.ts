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

  // Obtener incidencias pendientes con su municipio y evidencias
  const { data: incidencias, error } = await supabase
    .from('incidencias')
    .select(`
      id,
      protocol_id,
      tipo,
      descripcion,
      geom_publica,
      creado_en,
      municipios (
        codigo_ine,
        nombre,
        provincia
      ),
      evidencias (
        id,
        protocol_id,
        url_storage,
        hash_sha256
      )
    `)
    .eq('estado_moderacion', 'pendiente')
    .order('creado_en', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Generar URLs firmadas para las imágenes
  const itemsWithUrls = await Promise.all(
    (incidencias || []).map(async (inc: any) => {
      const evidenciasWithUrls = await Promise.all(
        (inc.evidencias || []).map(async (evi: any) => {
          const { data } = await supabase.storage
            .from('evidencias')
            .createSignedUrl(evi.url_storage, 3600)
          return {
            ...evi,
            signedUrl: data?.signedUrl || null,
          }
        })
      )
      return {
        ...inc,
        evidencias: evidenciasWithUrls,
      }
    })
  )

  return NextResponse.json({ items: itemsWithUrls })
}

export async function POST(request: Request) {
  const { supabase, user, isAuthorized } = await verifyAdmin()
  if (!isAuthorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { incidenciaId, decision, motivo, retouchedBase64, newSha256 } = body

  if (!incidenciaId || !decision) {
    return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 })
  }

  // 1. Obtener estado actual
  const { data: currentInc, error: fetchErr } = await supabase
    .from('incidencias')
    .select('id, estado_moderacion, evidencias(id, url_storage)')
    .eq('id', incidenciaId)
    .single()

  if (fetchErr || !currentInc) {
    return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 })
  }

  // 2. Si se retocó imagen, actualizar storage y tabla evidencias
  if (decision === 'retocado' && retouchedBase64 && newSha256) {
    const evi = (currentInc as any).evidencias?.[0]
    if (evi) {
      const buffer = Buffer.from(retouchedBase64, 'base64')
      await supabase.storage
        .from('evidencias')
        .upload(evi.url_storage, buffer, { contentType: 'image/jpeg', upsert: true })

      await supabase
        .from('evidencias')
        .update({ hash_sha256: newSha256 })
        .eq('id', evi.id)
    }
  }

  // 3. Actualizar incidencia
  const nuevoEstado = decision === 'rechazado' ? 'rechazado' : 'aprobado'
  const nivelConfianza = decision === 'rechazado' ? 1 : 2

  const { error: updateErr } = await supabase
    .from('incidencias')
    .update({
      estado_moderacion: nuevoEstado,
      motivo_moderacion: motivo || null,
      moderado_por: user?.id || null,
      moderado_en: new Date().toISOString(),
      nivel_confianza: nivelConfianza,
    })
    .eq('id', incidenciaId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // 4. Registrar log inmutable de moderación
  await supabase.from('moderacion_logs').insert({
    incidencia_id: incidenciaId,
    moderador_id: user?.id || null,
    decision,
    motivo: motivo || null,
    estado_anterior: currentInc.estado_moderacion,
  })

  return NextResponse.json({ ok: true, estado: nuevoEstado })
}
