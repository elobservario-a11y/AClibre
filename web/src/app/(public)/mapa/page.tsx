import { createClient } from '@/lib/supabase/server'
import MapLibreView, { type MapIncidencia } from '@/components/MapLibreView'

export const metadata = {
  title: 'Mapa Nacional de Incidencias — Slowvan',
  description: 'Mapa de restricciones, señales ilegales y multas a vehículos vivienda en España.',
}

export const revalidate = 60 // Revalida cada 60s

export default async function MapaPage() {
  const supabase = await createClient()

  // Consulta solo incidencias aprobadas
  const { data, error } = await supabase
    .from('incidencias')
    .select(`
      id,
      protocol_id,
      tipo,
      descripcion,
      geom_publica,
      municipios (
        codigo_ine,
        nombre,
        provincia
      )
    `)
    .eq('estado_moderacion', 'aprobado')

  // Parsear coordenadas desde PostGIS (si viene en formato GeoJSON o texto WKT)
  const incidencias: MapIncidencia[] = (data || []).map((row: any) => {
    let lon = -3.7
    let lat = 40.4

    if (row.geom_publica) {
      if (typeof row.geom_publica === 'string' && row.geom_publica.includes('POINT')) {
        const match = row.geom_publica.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i)
        if (match) {
          lon = parseFloat(match[1])
          lat = parseFloat(match[2])
        }
      } else if (row.geom_publica.coordinates) {
        lon = row.geom_publica.coordinates[0]
        lat = row.geom_publica.coordinates[1]
      }
    }

    return {
      id: row.id,
      protocol_id: row.protocol_id,
      tipo: row.tipo,
      descripcion: row.descripcion,
      lon,
      lat,
      municipio: row.municipios || { codigo_ine: '00000', nombre: 'Desconocido', provincia: '' },
    }
  })

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Mapa de incidencias</h1>
          <p className="text-xs text-gray-500">
            {incidencias.length} incidencias aprobadas en toda España. Las coordenadas están ofuscadas a ≈100m.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span> Señal ilegal
          </span>
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500"></span> Multa
          </span>
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span> Desalojo
          </span>
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500"></span> Bloqueo acceso
          </span>
          <a
            href="/reportar"
            className="rounded-xl bg-orange-500 px-3.5 py-2 font-bold text-white shadow hover:bg-orange-600"
          >
            + Reportar
          </a>
        </div>
      </div>

      <MapLibreView incidencias={incidencias} />
    </main>
  )
}
