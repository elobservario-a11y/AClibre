import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 60

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ine: string }> }
) {
  try {
    const { ine } = await params
    if (!ine || ine.length !== 5) {
      return NextResponse.json({ error: 'Código INE de 5 dígitos no válido' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Datos del municipio
    const { data: muni, error: muniErr } = await supabase
      .from('municipios')
      .select('id, codigo_ine, nombre, provincia, comunidad, poblacion, geom')
      .eq('codigo_ine', ine)
      .single()

    if (muniErr || !muni) {
      return NextResponse.json({ error: 'Municipio no encontrado' }, { status: 404 })
    }

    // 2. Normas del municipio
    const { data: normas } = await supabase
      .from('normas')
      .select(`
        protocol_id,
        tipo,
        estado,
        plazo_alegaciones_hasta,
        url_publicacion,
        hallazgos (
          articulo,
          cita_literal,
          tipo_restriccion,
          fundamento_ilegalidad
        )
      `)
      .eq('municipio_id', muni.id)

    // 3. Incidencias aprobadas
    const { data: incidencias } = await supabase
      .from('incidencias')
      .select('protocol_id, tipo, descripcion, nivel_confianza, creado_en, geom_publica')
      .eq('municipio_id', muni.id)
      .eq('estado_moderacion', 'aprobado')

    const maxNivel = (incidencias || []).reduce(
      (max, inc) => Math.max(max, inc.nivel_confianza || 1),
      1
    )

    return NextResponse.json(
      {
        version: 'v1',
        licencia: 'AGPL-3.0 / Open Data Slowvan',
        municipio: {
          ...muni,
          escalera_nivel_confianza: maxNivel,
        },
        normas: normas || [],
        incidencias: incidencias || [],
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
