import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obfuscateCoords } from '@/lib/geo'

const TIPOS_VALIDOS = ['senal_ilegal', 'multa', 'desalojo', 'bloqueo_acceso']

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado. Se requiere inicio de sesión.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      turnstileToken,
      codigoIne,
      tipo,
      descripcion,
      lat,
      lon,
    } = body

    // 1. Verificación obligatoria de Turnstile en servidor
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
    if (!turnstileToken) {
      return NextResponse.json({ error: 'Falta token de verificación Turnstile' }, { status: 400 })
    }

    if (turnstileSecret) {
      const formData = new URLSearchParams()
      formData.append('secret', turnstileSecret)
      formData.append('response', turnstileToken)

      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      })
      const verifyData = await verifyRes.json()

      if (!verifyData.success) {
        return NextResponse.json({ error: 'Verificación antibot Turnstile fallida' }, { status: 403 })
      }
    }

    // 2. Validaciones de datos
    if (!codigoIne || typeof codigoIne !== 'string' || codigoIne.length !== 5) {
      return NextResponse.json({ error: 'Código INE no válido' }, { status: 400 })
    }

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de incidencia no válido' }, { status: 400 })
    }

    if (!descripcion || typeof descripcion !== 'string' || descripcion.trim().length < 10) {
      return NextResponse.json({ error: 'La descripción debe tener al menos 10 caracteres' }, { status: 400 })
    }

    const exactLat = parseFloat(lat) || 40.0
    const exactLon = parseFloat(lon) || -3.7

    // 3. Ofuscación a ~100m en servidor
    const pub = obfuscateCoords(exactLat, exactLon)

    // 4. Obtener municipio
    const { data: muni, error: muniErr } = await supabase
      .from('municipios')
      .select('id')
      .eq('codigo_ine', codigoIne)
      .single()

    if (muniErr || !muni) {
      return NextResponse.json({ error: 'Municipio no encontrado' }, { status: 404 })
    }

    // 5. Generar protocol_id de forma atómica mediante RPC
    const { data: protocolId, error: rpcError } = await supabase
      .rpc('generar_protocol_id', { p_ine: codigoIne, p_tipo: 'INC' })

    if (rpcError || !protocolId) {
      return NextResponse.json({ error: 'Error generando identificador de protocolo' }, { status: 500 })
    }

    // 6. Insertar incidencia con usuario_id del JWT verificado
    const { data: incData, error: insErr } = await supabase
      .from('incidencias')
      .insert({
        protocol_id: protocolId,
        municipio_id: muni.id,
        usuario_id: user.id,
        tipo,
        descripcion: descripcion.trim(),
        geom: `SRID=4326;POINT(${exactLon} ${exactLat})`,
        geom_publica: `SRID=4326;POINT(${pub.lon} ${pub.lat})`,
        nivel_confianza: 1,
        estado_moderacion: 'pendiente',
      })
      .select('id')
      .single()

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      incidenciaId: incData.id,
      protocolId,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
