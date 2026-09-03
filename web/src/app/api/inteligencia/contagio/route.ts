import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: similitudes, error } = await supabase
      .from('similitudes_normas')
      .select(`
        id,
        porcentaje_similitud,
        fragmentos_coincidentes,
        posible_redactor,
        detectado_en,
        muni_a:municipio_a_id (
          id,
          codigo_ine,
          nombre,
          provincia
        ),
        muni_b:municipio_b_id (
          id,
          codigo_ine,
          nombre,
          provincia
        )
      `)
      .order('porcentaje_similitud', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Construir estructura de nodos y enlaces
    const nodesMap: Record<number, any> = {}
    const links: any[] = []

    for (const sim of similitudes || []) {
      const ma: any = sim.muni_a
      const mb: any = sim.muni_b

      if (!ma || !mb) continue

      if (!nodesMap[ma.id]) {
        nodesMap[ma.id] = {
          id: ma.id,
          ine: ma.codigo_ine,
          nombre: ma.nombre,
          provincia: ma.provincia,
          conexiones: 0,
        }
      }
      if (!nodesMap[mb.id]) {
        nodesMap[mb.id] = {
          id: mb.id,
          ine: mb.codigo_ine,
          nombre: mb.nombre,
          provincia: mb.provincia,
          conexiones: 0,
        }
      }

      nodesMap[ma.id].conexiones += 1
      nodesMap[mb.id].conexiones += 1

      links.push({
        id: sim.id,
        source: ma.id,
        target: mb.id,
        source_name: ma.nombre,
        target_name: mb.nombre,
        porcentaje: Number(sim.porcentaje_similitud),
        fragmentos: sim.fragmentos_coincidentes || [],
        posible_redactor: sim.posible_redactor,
      })
    }

    return NextResponse.json({
      nodes: Object.values(nodesMap),
      links,
      total_clusters: links.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
