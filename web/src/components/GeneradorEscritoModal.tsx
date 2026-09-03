'use client'

import { useState } from 'react'

export interface GeneradorEscritoModalProps {
  tipoDocumento: 'alegacion' | 'reposicion' | 'transparencia'
  protocolId: string
  municipioNombre: string
  labelBoton?: string
  subtitulo?: string
}

const CONFIG_MAP = {
  alegacion: {
    tituloModal: 'Escrito de Alegaciones en Información Pública',
    colorBtn: 'bg-orange-600 hover:bg-orange-700',
    borderBtn: 'border-orange-200',
    badge: 'Art. 83 Ley 39/2015 (LPAC)',
    defaultLabel: '📄 Generar alegaciones en plazo (PDF)',
  },
  reposicion: {
    tituloModal: 'Recurso Potestativo de Reposición',
    colorBtn: 'bg-red-700 hover:bg-red-800',
    borderBtn: 'border-red-200',
    badge: 'Arts. 123 y 124 Ley 39/2015 (LPAC)',
    defaultLabel: '⚖️ Generar recurso de reposición (PDF)',
  },
  transparencia: {
    tituloModal: 'Solicitud de Información Pública (Ley 19/2013)',
    colorBtn: 'bg-blue-700 hover:bg-blue-800',
    borderBtn: 'border-blue-200',
    badge: 'Art. 12 Ley 19/2013 de Transparencia',
    defaultLabel: '🔍 Pedir expediente por Transparencia (PDF)',
  },
}

export default function GeneradorEscritoModal({
  tipoDocumento,
  protocolId,
  municipioNombre,
  labelBoton,
  subtitulo,
}: GeneradorEscritoModalProps) {
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [email, setEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const cfg = CONFIG_MAP[tipoDocumento]

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/documentos/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoDocumento,
          protocolId,
          nombre,
          dni,
          domicilio,
          email,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error generando el documento')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tipoDocumento}_${municipioNombre}_${protocolId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setOpen(false)
    } catch (err: any) {
      setError(err.message || 'Error al descargar')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-2 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow transition ${cfg.colorBtn}`}
      >
        <span>{labelBoton || cfg.defaultLabel}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  {cfg.badge}
                </span>
                <h3 className="text-base font-black text-gray-900">
                  {cfg.tituloModal}
                </h3>
                <p className="text-xs text-gray-600 font-medium">
                  {municipioNombre} · Protocolo: {protocolId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-700 leading-relaxed border border-gray-200">
              <strong>El sistema prepara el documento técnico con fundamentación jurídica; tú lo firmas y lo presentas.</strong> Tus datos solo se usan para estampar la comparecencia en el PDF y <strong>nunca se almacenan en el servidor</strong>.
            </div>

            <form onSubmit={handleDownload} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700">
                  Nombre y Apellidos <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Jose Montero García"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700">
                    DNI / NIE <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="12345678Z"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">
                  Domicilio a efectos de notificaciones <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Calle, número, código postal y localidad"
                  value={domicilio}
                  onChange={(e) => setDomicilio(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs focus:border-orange-500 focus:outline-none"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="mt-2 flex gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white shadow disabled:opacity-50 ${cfg.colorBtn}`}
                >
                  {generating ? 'Generando PDF…' : 'Descargar PDF oficial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
