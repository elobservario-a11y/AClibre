'use client'

import { useState, useEffect, useCallback } from 'react'
import MunicipioSearch from '@/components/MunicipioSearch'

interface AccionItem {
  id: string
  protocol_id: string
  tipo: string
  estado: string
  fecha_presentacion: string
  plazo_limite: string
  numero_registro: string | null
  organismo_destino: string | null
  resultado_tipo: string | null
  resultado_en: string | null
  notas: string | null
  dias_restantes: number | null
  plazo_vencido: boolean
  municipios?: {
    id: number
    codigo_ine: string
    nombre: string
    provincia: string
  }
}

const TIPO_LABELS: Record<string, string> = {
  alegacion_ordenanza: 'Alegación a Ordenanza',
  recurso_reposicion: 'Recurso de Reposición',
  solicitud_expediente_senal: 'Solicitud Transparencia',
  recurso_multa: 'Recurso de Multa',
  reclamacion_previa: 'Reclamación Previa',
}

const ESTADO_BADGES: Record<string, { label: string; color: string }> = {
  presentada: { label: 'En plazo de respuesta', color: 'bg-blue-100 text-blue-800' },
  respondida: { label: 'Respondida', color: 'bg-purple-100 text-purple-800' },
  estimada: { label: '🏆 Estimada (Victoria)', color: 'bg-green-100 text-green-800' },
  desestimada: { label: 'Desestimada', color: 'bg-red-100 text-red-800' },
  silencio: { label: 'Silencio administrativo', color: 'bg-gray-100 text-gray-800' },
  borrador: { label: 'Borrador', color: 'bg-yellow-100 text-yellow-800' },
}

export default function MisAccionesPage() {
  const [acciones, setAcciones] = useState<AccionItem[]>([])
  const [loading, setLoading] = useState(true)

  // Modal registrar nueva acción
  const [modalRegistroOpen, setModalRegistroOpen] = useState(false)
  const [muniSel, setMuniSel] = useState<{ id?: number; codigo_ine: string; nombre: string; provincia: string } | null>(null)
  const [tipoAccion, setTipoAccion] = useState('alegacion_ordenanza')
  const [fechaPres, setFechaPres] = useState(new Date().toISOString().split('T')[0])
  const [numReg, setNumReg] = useState('')
  const [organismo, setOrganismo] = useState('')
  const [saving, setSaving] = useState(false)

  // Modal respuesta recibida
  const [modalRespuestaOpen, setModalRespuestaOpen] = useState(false)
  const [selectedAccion, setSelectedAccion] = useState<AccionItem | null>(null)
  const [resultadoEstado, setResultadoEstado] = useState<'estimada' | 'desestimada' | 'silencio'>('estimada')
  const [resultadoNotas, setResultadoNotas] = useState('')
  const [updating, setUpdating] = useState(false)

  const fetchAcciones = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/acciones')
      if (res.ok) {
        const data = await res.json()
        setAcciones(data.items || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAcciones()
  }, [fetchAcciones])

  const handleCrearAccion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!muniSel) {
      alert('Por favor selecciona el municipio de la acción')
      return
    }

    setSaving(true)
    try {
      // Si muniSel no trae id, buscar id
      let mId = (muniSel as any).id
      if (!mId) {
        const resM = await fetch(`/api/municipios/buscar?q=${encodeURIComponent(muniSel.codigo_ine)}`)
        const dataM = await resM.json()
        mId = dataM[0]?.id
      }

      const res = await fetch('/api/acciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoAccion,
          municipioId: mId,
          fechaPresentacion: fechaPres,
          numeroRegistro: numReg,
          organismoDestino: organismo || `Ayuntamiento de ${muniSel.nombre}`,
        }),
      })

      if (res.ok) {
        setModalRegistroOpen(false)
        setNumReg('')
        setOrganismo('')
        fetchAcciones()
      } else {
        const err = await res.json()
        alert(err.error || 'Error al guardar la acción')
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleGuardarRespuesta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccion) return

    setUpdating(true)
    try {
      const res = await fetch('/api/acciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAccion.id,
          estado: resultadoEstado,
          notas: resultadoNotas,
        }),
      })

      if (res.ok) {
        setModalRespuestaOpen(false)
        setSelectedAccion(null)
        setResultadoNotas('')
        fetchAcciones()
      } else {
        const err = await res.json()
        alert(err.error || 'Error al actualizar')
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión')
    } finally {
      setUpdating(false)
    }
  }

  const totalIniciadas = acciones.length
  const enPlazo = acciones.filter((a) => a.estado === 'presentada' && !a.plazo_vencido).length
  const victorias = acciones.filter((a) => a.estado === 'estimada').length
  const silencioCount = acciones.filter((a) => a.estado === 'silencio' || (a.estado === 'presentada' && a.plazo_vencido)).length

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* Cabecera */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
            Panel de Batalla Ciudadana
          </span>
          <h1 className="mt-1 text-3xl font-black text-gray-900">Mis Acciones</h1>
          <p className="mt-1 text-sm text-gray-500">
            Control de alegaciones, recursos y solicitudes presentadas con cuenta atrás de respuesta administrativa.
          </p>
        </div>
        <button
          onClick={() => setModalRegistroOpen(true)}
          className="rounded-2xl bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-700"
        >
          + Registrar presentación oficial
        </button>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-gray-500">Total Iniciadas</span>
          <p className="mt-1 text-2xl font-black text-gray-900">{totalIniciadas}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <span className="text-xs font-semibold text-blue-700">En plazo respuesta</span>
          <p className="mt-1 text-2xl font-black text-blue-900">{enPlazo}</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4 shadow-sm">
          <span className="text-xs font-semibold text-green-700">Victorias (Estimadas)</span>
          <p className="mt-1 text-2xl font-black text-green-900">{victorias}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
          <span className="text-xs font-semibold text-gray-600">Silencio / Vencidas</span>
          <p className="mt-1 text-2xl font-black text-gray-800">{silencioCount}</p>
        </div>
      </div>

      {/* Listado de acciones */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">
          <span className="text-3xl animate-bounce">⏳</span>
          <p className="mt-2 font-medium">Cargando tus expedientes…</p>
        </div>
      ) : acciones.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <span className="text-5xl">📋</span>
          <h3 className="mt-3 text-lg font-bold text-gray-900">No tienes acciones registradas todavía</h3>
          <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
            Cuando descargues un escrito de alegación, reposición o solicitud y lo presentes en la sede electrónica o REC, regístralo aquí con su número de entrada para que controlemos la cuenta atrás legal de respuesta.
          </p>
          <button
            onClick={() => setModalRegistroOpen(true)}
            className="mt-5 inline-block rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-orange-700"
          >
            Registrar mi primera acción
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {acciones.map((acc) => {
            const badge = ESTADO_BADGES[acc.estado] || { label: acc.estado, color: 'bg-gray-100 text-gray-700' }
            const muni = acc.municipios

            return (
              <div
                key={acc.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300"
              >
                {/* Cabecera tarjeta */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-orange-600">{acc.protocol_id}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
                      {TIPO_LABELS[acc.tipo] || acc.tipo}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 font-bold ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <span className="text-gray-400">
                    Presentada: {acc.fecha_presentacion}
                  </span>
                </div>

                {/* Contenido */}
                <div className="py-3">
                  <h3 className="text-base font-bold text-gray-900">
                    {muni ? `${muni.nombre} (${muni.provincia})` : 'Municipio no especificado'}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Destino: {acc.organismo_destino || 'Registro General'}
                    {acc.numero_registro && (
                      <span className="ml-2 font-mono font-bold text-gray-800">
                        · № Registro: {acc.numero_registro}
                      </span>
                    )}
                  </p>

                  {/* Semáforo de cuenta atrás de respuesta */}
                  {acc.estado === 'presentada' && (
                    <div className="mt-3">
                      {acc.plazo_vencido ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                          ⚠️ <strong>Plazo legal de respuesta superado ({acc.plazo_limite}).</strong>
                          <p className="mt-0.5 text-[11px] text-red-700">
                            Opera el silencio administrativo desestimatorio. El Ayuntamiento no ha contestado en plazo, lo que deja expedita la vía del recurso de alzada o la vía judicial contencioso-administrativa.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            ⏳ <strong>Cuenta atrás de respuesta:</strong> Quedan <strong>{acc.dias_restantes} días</strong> para que la Administración responda legalmente.
                          </span>
                          <span className="font-mono text-[11px] font-bold text-blue-700">
                            Vence: {acc.plazo_limite}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {acc.notas && (
                    <p className="mt-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                      <strong>Notas:</strong> {acc.notas}
                    </p>
                  )}
                </div>

                {/* Acciones tarjeta */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs">
                  <span className="text-gray-400">
                    {acc.resultado_en ? `Resuelto el: ${new Date(acc.resultado_en).toLocaleDateString('es-ES')}` : 'En seguimiento'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccion(acc)
                      setModalRespuestaOpen(true)
                    }}
                    className="rounded-xl border border-gray-300 bg-white px-3.5 py-1.5 font-bold text-gray-700 hover:bg-gray-50"
                  >
                    📝 He recibido respuesta / Actualizar estado
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal registrar nueva presentación */}
      {modalRegistroOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-gray-900">
                Registrar presentación oficial
              </h3>
              <button
                type="button"
                onClick={() => setModalRegistroOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearAccion} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700">Municipio *</label>
                <div className="mt-1">
                  <MunicipioSearch value={muniSel} onChange={setMuniSel} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">Tipo de escrito presentado *</label>
                <select
                  value={tipoAccion}
                  onChange={(e) => setTipoAccion(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs focus:border-orange-500 focus:outline-none"
                >
                  <option value="alegacion_ordenanza">Alegación en información pública (3 meses respuesta)</option>
                  <option value="recurso_reposicion">Recurso de reposición (1 mes respuesta)</option>
                  <option value="solicitud_expediente_senal">Solicitud de transparencia señal/gálibo (1 mes respuesta)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700">Fecha de presentación *</label>
                  <input
                    type="date"
                    required
                    value={fechaPres}
                    onChange={(e) => setFechaPres(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700">№ de Registro (REC / Sede)</label>
                  <input
                    type="text"
                    placeholder="REGAGE26e00012345"
                    value={numReg}
                    onChange={(e) => setNumReg(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs focus:border-orange-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">Organismo de destino</label>
                <input
                  type="text"
                  placeholder="Ej: Ayuntamiento de Ribadesella"
                  value={organismo}
                  onChange={(e) => setOrganismo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="mt-2 flex gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setModalRegistroOpen(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white shadow hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Registrar acción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal he recibido respuesta */}
      {modalRespuestaOpen && selectedAccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-gray-900">
                Registrar Resolución Administrativa
              </h3>
              <button
                type="button"
                onClick={() => setModalRespuestaOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarRespuesta} className="mt-4 flex flex-col gap-3">
              <p className="text-xs text-gray-600">
                Expediente: <strong>{selectedAccion.protocol_id}</strong>
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  ¿Cuál ha sido la respuesta de la Administración?
                </label>
                <div className="flex flex-col gap-2 text-xs">
                  <label className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 cursor-pointer">
                    <input
                      type="radio"
                      name="resultado"
                      value="estimada"
                      checked={resultadoEstado === 'estimada'}
                      onChange={() => setResultadoEstado('estimada')}
                    />
                    <div>
                      <strong className="text-green-900">🏆 Estimada (Victoria)</strong>
                      <p className="text-[11px] text-green-700">El Ayuntamiento ha aceptado las alegaciones o retirado la señal/precepto.</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 cursor-pointer">
                    <input
                      type="radio"
                      name="resultado"
                      value="desestimada"
                      checked={resultadoEstado === 'desestimada'}
                      onChange={() => setResultadoEstado('desestimada')}
                    />
                    <div>
                      <strong className="text-red-900">❌ Desestimada</strong>
                      <p className="text-[11px] text-red-700">El Ayuntamiento ha rechazado formalmente el escrito.</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 cursor-pointer">
                    <input
                      type="radio"
                      name="resultado"
                      value="silencio"
                      checked={resultadoEstado === 'silencio'}
                      onChange={() => setResultadoEstado('silencio')}
                    />
                    <div>
                      <strong className="text-gray-900">⏳ Silencio administrativo</strong>
                      <p className="text-[11px] text-gray-600">Ha vencido el plazo legal sin ninguna contestación.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">Notas o extracto de la resolución</label>
                <textarea
                  rows={3}
                  placeholder="Explica brevemente los motivos o detalles dados por el consistorio…"
                  value={resultadoNotas}
                  onChange={(e) => setResultadoNotas(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="mt-2 flex gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setModalRespuestaOpen(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white shadow hover:bg-orange-700 disabled:opacity-50"
                >
                  {updating ? 'Guardando…' : 'Guardar resolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
