import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado. Se requiere inicio de sesión.' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('acciones')
      .select(`
        id,
        protocol_id,
        tipo,
        estado,
        fecha_presentacion,
        plazo_limite,
        numero_registro,
        organismo_destino,
        resultado_tipo,
        resultado_en,
        notas,
        creado_en,
        municipios (
          id,
          codigo_ine,
          nombre,
          provincia
        )
      `)
      .eq('usuario_id', user.id)
      .order('creado_en', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calcular días restantes y estado de plazo
    const enriched = (data || []).map((acc) => {
      let diasRestantes = null
      let plazoVencido = false

      if (acc.plazo_limite) {
        const diff = new Date(acc.plazo_limite).getTime() - Date.now()
        diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24))
        plazoVencido = diasRestantes <= 0
      }

      return {
        ...acc,
        dias_restantes: diasRestantes,
        plazo_vencido: plazoVencido,
      }
    })

    return NextResponse.json({ items: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado. Se requiere inicio de sesión.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      tipo = 'alegacion_ordenanza',
      municipioId,
      fechaPresentacion,
      numeroRegistro,
      organismoDestino,
      email,
      notas,
      normaId,
      incidenciaId,
    } = body

    if (!municipioId || !fechaPresentacion) {
      return NextResponse.json({ error: 'Municipio y fecha de presentación son obligatorios' }, { status: 400 })
    }

    // 1. Obtener codigo_ine del municipio
    const { data: muni, error: muniErr } = await supabase
      .from('municipios')
      .select('codigo_ine, nombre')
      .eq('id', municipioId)
      .single()

    if (muniErr || !muni) {
      return NextResponse.json({ error: 'Municipio no encontrado' }, { status: 404 })
    }

    // 2. Generar protocol_id para la acción
    const { data: protocolId, error: rpcErr } = await supabase
      .rpc('generar_protocol_id', { p_ine: muni.codigo_ine, p_tipo: 'ACC' })
    if (rpcErr) throw rpcErr

    // 3. Insertar la acción vinculada obligatoriamente al usuario autenticado
    const { data: nuevaAccion, error: insErr } = await supabase
      .from('acciones')
      .insert({
        protocol_id: protocolId,
        municipio_id: municipioId,
        usuario_id: user.id,
        tipo,
        estado: 'presentada',
        fecha_presentacion: fechaPresentacion,
        numero_registro: numeroRegistro || null,
        organismo_destino: organismoDestino || `Ayuntamiento de ${muni.nombre}`,
        email: user.email || (email ? email.trim().toLowerCase() : null),
        notas: notas || null,
        norma_id: normaId || null,
        incidencia_id: incidenciaId || null,
      })
      .select()
      .single()

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, accion: nuevaAccion })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado. Se requiere inicio de sesión.' }, { status: 401 })
    }

    const body = await request.json()
    const { id, estado, notas } = body

    if (!id || !estado) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('acciones')
      .update({
        estado,
        resultado_tipo: estado,
        resultado_en: new Date().toISOString(),
        notas: notas || null,
      })
      .eq('id', id)
      .eq('usuario_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, accion: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
