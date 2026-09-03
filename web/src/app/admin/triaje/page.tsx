'use client'

import { useState, useEffect, useCallback } from 'react'
import MunicipioSearch from '@/components/MunicipioSearch'

interface TriageItem {
  id: string
  titulo: string
  url_origen: string
  fecha_boletin: string
  texto_extraido: string
  afecta_caravaning: boolean
  tipo_acto: string
  confianza_triaje: number
  estado_triaje: string
  resultado_triaje?: {
    afecta_caravaning: boolean
    tipo_acto: string
    municipio_nombre?: string
    plazo_alegaciones_dias?: number
    confianza: number
    justificacion: string
  }
  municipios?: {
    id: number
    codigo_ine: string
    nombre: string
    provincia: string
  }
}

export default function AdminTriajePage() {
  const [items, setItems] = useState<TriageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [editingMuni, setEditingMuni] = useState<{ [id: string]: any }>({})

  const fetchTriage = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/triaje')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTriage()
  }, [fetchTriage])

  const handleAction = async (publicacionId: string, decision: 'ascender' | 'descartar', muniId?: number) => {
    setProcessingId(publicacionId)
    try {
      const res = await fetch('/api/admin/triaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicacionId,
          decision,
          municipioId: muniId,
          tipoNorma: 'circulacion',
        }),
      })

      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.id !== publicacionId))
      } else {
        const err = await res.json()
        alert(err.error || 'Error al procesar')
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <span className="text-3xl animate-bounce">🤖</span>
        <p className="mt-3 text-sm text-gray-500 font-medium">Cargando bandeja de triaje con IA…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Bandeja de Triaje (Haiku)</h1>
          <p className="mt-1 text-xs text-gray-500">
            Anuncios que superaron el prefiltro y fueron clasificados por el modelo de triaje. Confirma su ascenso a ordenanzas oficiales.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin"
            className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            ← Volver a Moderación
          </a>
          <button
            onClick={fetchTriage}
            className="rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-orange-600"
          >
            Actualizar ({items.length})
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <span className="text-5xl">✨</span>
          <h2 className="mt-3 text-lg font-bold text-gray-900">Bandeja de triaje al día</h2>
          <p className="mt-1 text-xs text-gray-500">
            No hay anuncios candidatos pendientes de confirmación en este momento.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => {
            const muni = editingMuni[item.id] || item.municipios
            const isProcessing = processingId === item.id

            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-5 shadow-sm transition ${
                  item.afecta_caravaning
                    ? 'border-orange-200 bg-orange-50/40'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {/* Metadatos y badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-bold ${
                        item.afecta_caravaning
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.afecta_caravaning ? '🚨 Afecta Caravaning' : 'No relevante'}
                    </span>
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-semibold text-blue-800 uppercase">
                      {item.tipo_acto || 'Trámite no definido'}
                    </span>
                    <span className="text-gray-400">
                      Confianza: {Math.round((item.confianza_triaje || 0.9) * 100)}%
                    </span>
                  </div>
                  <span className="text-gray-400 font-mono">
                    Boletín: {item.fecha_boletin}
                  </span>
                </div>

                {/* Título y texto */}
                <div className="py-3">
                  <h3 className="font-bold text-gray-900 leading-snug">{item.titulo}</h3>
                  <p className="mt-2 text-xs text-gray-600 leading-relaxed max-h-24 overflow-y-auto">
                    {item.texto_extraido}
                  </p>
                  {item.resultado_triaje?.justificacion && (
                    <p className="mt-2 rounded-lg bg-gray-100 p-2 text-[11px] text-gray-600 italic">
                      💡 Criterio IA: {item.resultado_triaje.justificacion}
                    </p>
                  )}
                </div>

                {/* Asignación de municipio y acciones */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Municipio:</span>
                    {muni ? (
                      <span className="font-bold text-orange-700">
                        {muni.nombre} ({muni.provincia})
                      </span>
                    ) : (
                      <span className="text-red-500 font-medium">⚠️ No detectado automáticamente</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={item.url_origen}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Ver boletín ↗
                    </a>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleAction(item.id, 'descartar')}
                      className="rounded-xl border border-red-200 bg-white px-3 py-1.5 font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleAction(item.id, 'ascender', muni?.id)}
                      className="rounded-xl bg-orange-500 px-4 py-1.5 font-bold text-white shadow hover:bg-orange-600 disabled:opacity-50"
                    >
                      {isProcessing ? 'Procesando…' : '✓ Ascender a Norma'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
