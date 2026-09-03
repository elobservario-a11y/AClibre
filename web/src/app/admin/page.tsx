'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import ImageBlurEditor from '@/components/ImageBlurEditor'

interface IncidenciaItem {
  id: string
  protocol_id: string
  tipo: string
  descripcion: string
  creado_en: string
  municipios: {
    codigo_ine: string
    nombre: string
    provincia: string
  }
  evidencias: {
    id: string
    protocol_id: string
    url_storage: string
    hash_sha256: string
    signedUrl: string | null
  }[]
}

const MOTIVOS_RECHAZO = [
  'Matrículas o rostros visibles no difuminados',
  'No guarda relación con vehículos vivienda o caravaning',
  'Imagen sin valor probatorio o no se identifica la señal/lugar',
  'Datos personales de funcionarios o policía en la descripción',
  'Contenido ofensivo, amenazas o spam',
]

const TIPO_LABELS: Record<string, string> = {
  senal_ilegal: '🚫 Señal ilegal o no homologada',
  multa: '📄 Multa por estacionar',
  desalojo: '🚨 Desalojo de vehículo vivienda',
  bloqueo_acceso: '🚧 Bloqueo físico del acceso',
}

export default function AdminModeracionPage() {
  const [items, setItems] = useState<IncidenciaItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedReason, setSelectedReason] = useState(MOTIVOS_RECHAZO[0])
  const [customReason, setCustomReason] = useState('')
  const [retouchingUrl, setRetouchingUrl] = useState<string | null>(null)
  const [stats, setStats] = useState({ aprobados: 0, retocados: 0, rechazados: 0 })

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/moderacion')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        setCurrentIndex(0)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const currentItem = items[currentIndex]

  // Enviar decisión al backend
  const handleDecision = async (
    decision: 'aprobado' | 'retocado' | 'rechazado',
    motivo?: string,
    retouchedBlob?: Blob,
    newSha256?: string
  ) => {
    if (!currentItem || processing) return
    setProcessing(true)

    try {
      let retouchedBase64: string | undefined
      if (retouchedBlob) {
        const buffer = await retouchedBlob.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        retouchedBase64 = btoa(binary)
      }

      const res = await fetch('/api/admin/moderacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidenciaId: currentItem.id,
          decision,
          motivo,
          retouchedBase64,
          newSha256,
        }),
      })

      if (res.ok) {
        setStats((prev) => ({
          ...prev,
          [decision === 'aprobado' ? 'aprobados' : decision === 'retocado' ? 'retocados' : 'rechazados']:
            prev[decision === 'aprobado' ? 'aprobados' : decision === 'retocado' ? 'retocados' : 'rechazados'] + 1,
        }))
        // Pasar al siguiente
        setItems((prev) => prev.filter((it) => it.id !== currentItem.id))
      }
    } catch (e) {
      console.error(e)
      alert('Error guardando moderación. Inténtalo de nuevo.')
    } finally {
      setProcessing(false)
      setShowRejectModal(false)
      setRetouchingUrl(null)
    }
  }

  // Atajos de teclado en desktop (A = Aprobar, R = Retocar, X = Rechazar)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (retouchingUrl || showRejectModal || processing || !currentItem) return
      if (e.key === 'a' || e.key === 'A') {
        handleDecision('aprobado')
      } else if (e.key === 'r' || e.key === 'R') {
        const photoUrl = currentItem.evidencias?.[0]?.signedUrl
        if (photoUrl) setRetouchingUrl(photoUrl)
      } else if (e.key === 'x' || e.key === 'X') {
        setShowRejectModal(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentItem, retouchingUrl, showRejectModal, processing])

  if (loading) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <span className="text-3xl animate-bounce">⏳</span>
        <p className="mt-3 text-sm text-gray-500 font-medium">Cargando cola de moderación…</p>
      </main>
    )
  }

  if (!currentItem) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16 text-center">
        <span className="text-6xl">🎉</span>
        <h1 className="mt-4 text-2xl font-black text-gray-900">Cola limpia</h1>
        <p className="mt-2 text-sm text-gray-600">
          No hay más incidencias pendientes de moderación en este momento.
        </p>
        <div className="mt-6 flex gap-4 rounded-xl bg-gray-100 p-4 text-xs font-semibold text-gray-700">
          <span>✓ {stats.aprobados} aprobados</span>
          <span>✏️ {stats.retocados} retocados</span>
          <span>✕ {stats.rechazados} rechazados</span>
        </div>
        <button
          onClick={fetchQueue}
          className="mt-6 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-orange-600"
        >
          Actualizar cola
        </button>
      </main>
    )
  }

  const photo = currentItem.evidencias?.[0]?.signedUrl

  return (
    <main className="mx-auto max-w-lg px-3 py-4">
      {/* Barra superior de estado */}
      <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
        <span className="font-bold text-orange-600">
          Pendientes: {items.length}
        </span>
        <span className="text-gray-400">
          ID: {currentItem.protocol_id}
        </span>
      </div>

      {/* Tarjeta de moderación */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Imagen a tamaño completo */}
        <div className="relative h-72 w-full bg-black sm:h-80">
          {photo ? (
            <Image
              src={photo}
              alt="Evidencia"
              fill
              className="object-contain"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">
              Sin imagen adjunta
            </div>
          )}
        </div>

        {/* Datos de la incidencia */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">
              {currentItem.municipios?.nombre}
              <span className="ml-1 text-xs font-normal text-gray-400">
                ({currentItem.municipios?.provincia})
              </span>
            </span>
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-bold text-orange-800">
              {TIPO_LABELS[currentItem.tipo] || currentItem.tipo}
            </span>
          </div>

          <p className="mt-2 text-sm text-gray-700 leading-relaxed">
            {currentItem.descripcion}
          </p>

          <p className="mt-2 text-[11px] text-gray-400">
            Reportado: {new Date(currentItem.creado_en).toLocaleString('es-ES')}
          </p>
        </div>

        {/* Acciones de 1 clic mobile-first */}
        <div className="grid grid-cols-3 gap-2 border-t border-gray-100 bg-gray-50 p-3">
          {/* Rechazar */}
          <button
            type="button"
            disabled={processing}
            onClick={() => setShowRejectModal(true)}
            className="flex flex-col items-center justify-center rounded-xl bg-white border border-red-200 py-2.5 text-red-600 transition active:scale-95 hover:bg-red-50 disabled:opacity-50"
          >
            <span className="text-lg">✕</span>
            <span className="text-xs font-bold">Rechazar</span>
            <span className="hidden text-[10px] text-gray-400 sm:inline">(X)</span>
          </button>

          {/* Retocar (Difuminar) */}
          <button
            type="button"
            disabled={processing || !photo}
            onClick={() => photo && setRetouchingUrl(photo)}
            className="flex flex-col items-center justify-center rounded-xl bg-white border border-blue-200 py-2.5 text-blue-600 transition active:scale-95 hover:bg-blue-50 disabled:opacity-50"
          >
            <span className="text-lg">✏️</span>
            <span className="text-xs font-bold">Retocar</span>
            <span className="hidden text-[10px] text-gray-400 sm:inline">(R)</span>
          </button>

          {/* Aprobar */}
          <button
            type="button"
            disabled={processing}
            onClick={() => handleDecision('aprobado')}
            className="flex flex-col items-center justify-center rounded-xl bg-green-600 py-2.5 text-white transition active:scale-95 hover:bg-green-700 disabled:opacity-50 shadow-sm"
          >
            <span className="text-lg">✓</span>
            <span className="text-xs font-bold">Aprobar</span>
            <span className="hidden text-[10px] text-green-200 sm:inline">(A)</span>
          </button>
        </div>
      </div>

      {/* Editor de Difuminado */}
      {retouchingUrl && (
        <ImageBlurEditor
          imageUrl={retouchingUrl}
          onCancel={() => setRetouchingUrl(null)}
          onSave={(blob, sha256) => handleDecision('retocado', 'Matrícula o rostro difuminado', blob, sha256)}
        />
      )}

      {/* Modal de Rechazo Rápido */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900">Motivo de rechazo</h3>
            <p className="mt-1 text-xs text-gray-500">
              Se guardará en el registro inmutable y se notificará al usuario.
            </p>

            <div className="mt-3 flex flex-col gap-2">
              {MOTIVOS_RECHAZO.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedReason(m)}
                  className={`rounded-xl border p-2.5 text-left text-xs transition ${
                    selectedReason === m
                      ? 'border-red-500 bg-red-50 font-bold text-red-800'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {m}
                </button>
              ))}
              <input
                type="text"
                placeholder="Otro motivo específico…"
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value)
                  setSelectedReason(e.target.value)
                }}
                className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => handleDecision('rechazado', selectedReason)}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
