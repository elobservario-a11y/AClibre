'use client'

import { useState } from 'react'

export default function SuscripcionAlertas({
  municipioId,
  municipioNombre,
  provincia,
}: {
  municipioId?: number
  municipioNombre?: string
  provincia?: string
}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/alertas/suscribir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, municipioId, provincia }),
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const d = await res.json()
        setError(d.error || 'No se pudo activar la alerta')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-xs text-green-800">
        <p className="font-bold">✓ Alerta activada para {email}</p>
        <p className="mt-0.5 text-green-700">
          Te avisaremos por correo con la cuenta atrás si se publica una ordenanza en {municipioNombre || provincia || 'tu zona'}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-orange-950">
        <span>🔔</span>
        <span>Alertas de ordenanzas en {municipioNombre || provincia || 'España'}</span>
      </div>
      <p className="mt-1 text-xs text-orange-800 leading-snug">
        Recibe un aviso al instante si este ayuntamiento abre plazo de alegaciones, con los días que te quedan para alegar.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          required
          className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:border-orange-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-500 disabled:opacity-50"
        >
          {loading ? 'Guardando…' : 'Activar alerta'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  )
}
