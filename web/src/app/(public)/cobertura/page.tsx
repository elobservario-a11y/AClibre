import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Cobertura del Radar — Slowvan',
  description: 'Estado de monitorización de los 52 boletines oficiales provinciales de España.',
}

export const revalidate = 300

export default async function CoberturaPage() {
  const supabase = await createClient()

  const { data: fuentes } = await supabase
    .from('fuentes')
    .select('id, provincia, tipo, url_base, activo, ultimo_escaneo')
    .order('provincia')

  const total = fuentes?.length || 0
  const activos = (fuentes || []).filter((f) => f.activo).length
  const pct = total > 0 ? Math.round((activos / total) * 100) : 0

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900">Cobertura del Radar Normativo</h1>
        <p className="mt-2 text-sm text-gray-600">
          Estado público de la automatización de los 52 boletines provinciales de España. Si una provincia no está automatizada todavía, se indica aquí con total transparencia.
        </p>

        {/* Métrica */}
        <div className="mt-6 flex flex-wrap gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-gray-400">Provincias activas</span>
            <p className="text-2xl font-black text-orange-600">{activos} de {total} ({pct}%)</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-gray-400">Frecuencia de rastreo</span>
            <p className="text-2xl font-black text-gray-800">Diaria (07:00 CET)</p>
          </div>
        </div>
      </div>

      {/* Tabla de cobertura */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-gray-50 text-gray-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="p-3">Provincia</th>
              <th className="p-3">Tipo de acceso</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Fuente oficial</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(fuentes || []).map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="p-3 font-semibold text-gray-900">{f.provincia}</td>
                <td className="p-3 uppercase text-gray-500">{f.tipo}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-bold ${
                      f.activo
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {f.activo ? '● Activo' : '○ Pendiente adaptador'}
                  </span>
                </td>
                <td className="p-3">
                  <a
                    href={f.url_base}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:underline"
                  >
                    Boletín oficial ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
