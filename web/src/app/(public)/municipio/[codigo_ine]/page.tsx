import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import SuscripcionAlertas from '@/components/SuscripcionAlertas'

export const revalidate = 60

interface PageProps {
  params: Promise<{ codigo_ine: string }>
}

const TIPO_LABELS: Record<string, string> = {
  senal_ilegal: '🚫 Señal ilegal o no homologada',
  multa: '📄 Multa por estacionar',
  desalojo: '🚨 Desalojo de vehículo vivienda',
  bloqueo_acceso: '🚧 Bloqueo físico del acceso',
}

const ESCALERA_NIVEL: Record<number, { label: string; color: string }> = {
  1: { label: 'Nivel 1 · Reportado', color: 'bg-gray-100 text-gray-700' },
  2: { label: 'Nivel 2 · Documentado con foto', color: 'bg-blue-100 text-blue-800' },
  3: { label: 'Nivel 3 · Verificado con doc. oficial', color: 'bg-green-100 text-green-800' },
  4: { label: 'Nivel 4 · Conflicto normativo', color: 'bg-purple-100 text-purple-800' },
  5: { label: 'Nivel 5 · Revisado jurídicamente', color: 'bg-amber-100 text-amber-900' },
}

export default async function MunicipioPage({ params }: PageProps) {
  const { codigo_ine } = await params
  const supabase = await createClient()

  // 1. Obtener datos del municipio
  const { data: muni, error: muniError } = await supabase
    .from('municipios')
    .select('id, codigo_ine, nombre, provincia, comunidad, poblacion')
    .eq('codigo_ine', codigo_ine)
    .single()

  if (muniError || !muni) notFound()

  // 2. Obtener incidencias aprobadas
  const { data: incidencias } = await supabase
    .from('incidencias')
    .select(`
      id,
      protocol_id,
      tipo,
      descripcion,
      nivel_confianza,
      creado_en,
      evidencias (
        id,
        url_storage
      )
    `)
    .eq('municipio_id', muni.id)
    .eq('estado_moderacion', 'aprobado')
    .order('creado_en', { ascending: false })

  // 3. Obtener normas del municipio
  const { data: normas } = await supabase
    .from('normas')
    .select(`
      id,
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

  const maxNivel = (incidencias || []).reduce(
    (max, inc) => Math.max(max, inc.nivel_confianza || 1),
    1
  )

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* Breadcrumb */}
      <nav className="mb-4 text-xs text-gray-500">
        <a href="/mapa" className="hover:underline">Mapa</a> &gt;{' '}
        <span className="text-gray-700">{muni.provincia}</span> &gt;{' '}
        <span className="font-bold text-gray-900">{muni.nombre}</span>
      </nav>

      {/* Cabecera del Municipio */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
            INE: {muni.codigo_ine} · {muni.comunidad}
          </span>
          <h1 className="mt-1 text-3xl font-black text-gray-900">{muni.nombre}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Provincia de {muni.provincia}
            {muni.poblacion ? ` · ${muni.poblacion.toLocaleString('es-ES')} habitantes` : ''}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                ESCALERA_NIVEL[maxNivel]?.color || 'bg-gray-100 text-gray-700'
              }`}
            >
              {ESCALERA_NIVEL[maxNivel]?.label}
            </span>
          </div>
        </div>

        <a
          href={`/reportar?ine=${muni.codigo_ine}`}
          className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600"
        >
          📍 Reportar en este municipio
        </a>
      </div>

      {/* Suscripción a alertas de este municipio */}
      <div className="mt-6">
        <SuscripcionAlertas municipioId={muni.id} municipioNombre={muni.nombre} provincia={muni.provincia} />
      </div>

      {/* Normas y Ordenanzas */}
      <section className="mt-8">
        <h2 className="text-xl font-bold text-gray-900">Normativa municipal detectada</h2>
        {(!normas || normas.length === 0) ? (
          <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No constan ordenanzas específicas registradas en el radar para este municipio todavía.
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {normas.map((norma) => (
              <div key={norma.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">
                    Ordenanza de {norma.tipo} ({norma.protocol_id})
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 uppercase">
                    {norma.estado}
                  </span>
                </div>
                {norma.plazo_alegaciones_hasta && (() => {
                  const targetDate = new Date(norma.plazo_alegaciones_hasta)
                  const diffTime = targetDate.getTime() - Date.now()
                  const diasRestantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
                  const activo = diasRestantes > 0
                  return (
                    <div className={`mt-3 rounded-xl p-3 text-xs ${
                      activo ? 'border border-red-200 bg-red-50 text-red-900' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {activo ? (
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span>⏳ <strong>Cuenta atrás:</strong> Quedan <strong>{diasRestantes} días</strong> para presentar alegaciones</span>
                          <span className="font-mono text-[11px] font-bold text-red-700">Vence: {norma.plazo_alegaciones_hasta}</span>
                        </div>
                      ) : (
                        <span>Plazo de alegaciones cerrado el {norma.plazo_alegaciones_hasta}</span>
                      )}
                    </div>
                  )
                })()}
                {norma.hallazgos && norma.hallazgos.length > 0 && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {norma.hallazgos.map((h: any, idx: number) => (
                      <div key={idx} className="text-xs">
                        <span className="font-bold text-gray-800">{h.articulo}:</span>{' '}
                        <span className="italic text-gray-600">«{h.cita_literal}»</span>
                        <p className="mt-0.5 text-red-600 font-medium">Motivo: {h.fundamento_ilegalidad}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Incidencias documentadas */}
      <section className="mt-8">
        <h2 className="text-xl font-bold text-gray-900">
          Incidencias verificadas ({incidencias?.length || 0})
        </h2>
        {(!incidencias || incidencias.length === 0) ? (
          <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No hay incidencias aprobadas para este municipio. Si has visto una señal ilegal o te han multado, sé el primero en reportarla.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {incidencias.map((inc) => (
              <div key={inc.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-orange-600">{inc.protocol_id}</span>
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 font-semibold text-orange-800">
                    {TIPO_LABELS[inc.tipo] || inc.tipo}
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-700">{inc.descripcion}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
                  <span>{new Date(inc.creado_en).toLocaleDateString('es-ES')}</span>
                  <span>{ESCALERA_NIVEL[inc.nivel_confianza]?.label}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
