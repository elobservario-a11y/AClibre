import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 60

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ine = searchParams.get('ine')
    const estado = searchParams.get('estado')
    const tipo = searchParams.get('tipo')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)

    const supabase = createAdminClient()

    let query = supabase
      .from('normas')
      .select(`
        protocol_id,
        tipo,
        estado,
        plazo_alegaciones_hasta,
        url_publicacion,
        creado_en,
        municipios!inner (
          codigo_ine,
          nombre,
          provincia,
          comunidad
        ),
        hallazgos (
          articulo,
          cita_literal,
          tipo_restriccion,
          fundamento_ilegalidad
        )
      `)
      .order('creado_en', { ascending: false })
      .limit(limit)

    if (ine) {
      query = query.eq('municipios.codigo_ine', ine)
    }
    if (estado) {
      query = query.eq('estado', estado)
    }
    if (tipo) {
      query = query.eq('tipo', tipo)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        version: 'v1',
        total: data?.length || 0,
        licencia: 'AGPL-3.0 / Open Data Slowvan',
        data: data || [],
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
