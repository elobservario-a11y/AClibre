'use client'

import { useState } from 'react'

interface GeneradorAlegacionModalProps {
  protocolId: string
  municipioNombre: string
  plazoHasta: string
}

export default function GeneradorAlegacionModal({
  protocolId,
  municipioNombre,
  plazoHasta,
}: GeneradorAlegacionModalProps) {
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [email, setEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/normas/alegacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolId,
          nombre,
          dni,
          domicilio,
          email,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error generando el PDF')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Alegaciones_${municipioNombre}_${protocolId}.pdf`
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
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-700"
      >
        <span>📄</span>
        <span>Generar escrito de alegaciones (PDF)</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900">
                  Escrito de Alegaciones
                </h3>
                <p className="text-xs text-orange-600 font-semibold">
                  {municipioNombre} · Plazo hasta: {plazoHasta}
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

            <div className="mt-3 rounded-xl bg-orange-50 p-3 text-xs text-orange-900 leading-relaxed">
              <strong>El sistema prepara el documento; tú lo firmas y lo presentas.</strong> Tus datos personales se usan exclusivamente para rellenar el PDF en tu descarga y <strong>nunca se guardan en el servidor</strong>.
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
                  className="flex-1 rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white shadow hover:bg-orange-700 disabled:opacity-50"
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
