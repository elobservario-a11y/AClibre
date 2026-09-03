'use client'

import { useState } from 'react'
import MunicipioSearch from '@/components/MunicipioSearch'
import SuscripcionAlertas from '@/components/SuscripcionAlertas'

export default function AlertasPage() {
  const [muni, setMuni] = useState<{ codigo_ine: string; nombre: string; provincia: string } | null>(null)

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-8 text-center">
        <span className="text-5xl">🔔</span>
        <h1 className="mt-3 text-3xl font-black text-gray-900">Alertas del Radar Normativo</h1>
        <p className="mt-2 text-sm text-gray-600">
          Suscríbete para recibir un correo de alerta en el momento exacto en que un ayuntamiento abre plazo de alegaciones para una ordenanza que afecta al caravaning.
        </p>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-xs font-bold text-gray-700 uppercase tracking-wider">
          1. Elige el municipio a monitorizar
        </label>
        <MunicipioSearch value={muni} onChange={setMuni} />

        <div className="mt-6 border-t pt-6">
          <label className="mb-2 block text-xs font-bold text-gray-700 uppercase tracking-wider">
            2. Tu correo para recibir la alerta
          </label>
          <SuscripcionAlertas
            municipioNombre={muni ? muni.nombre : undefined}
            provincia={muni ? muni.provincia : undefined}
          />
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-orange-50 p-5 text-xs text-orange-900">
        <p className="font-bold">Privacidad y tranquilidad garantizada:</p>
        <p className="mt-1 text-orange-800">
          Solo te enviaremos un correo si se detecta un expediente que te afecte con la cuenta atrás de días restantes. Cero publicidad, cero newsletters, y baja inmediata con 1 clic en cualquier momento.
        </p>
      </div>
    </main>
  )
}
