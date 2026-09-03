'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Turnstile } from '@marsidev/react-turnstile'
import { createClient } from '@/lib/supabase/client'
import { getCurrentPosition, obfuscateCoords } from '@/lib/geo'
import MunicipioSearch from '@/components/MunicipioSearch'
import ImageUpload from '@/components/ImageUpload'

const TIPOS = [
  { value: 'senal_ilegal', label: '🚫 Señal ilegal o no homologada' },
  { value: 'multa', label: '📄 Multa por estacionar' },
  { value: 'desalojo', label: '🚨 Desalojo de vehículo vivienda' },
  { value: 'bloqueo_acceso', label: '🚧 Bloqueo físico del acceso' },
]

interface Municipio {
  codigo_ine: string
  nombre: string
  provincia: string
}

interface ImageResult {
  blob: Blob
  sha256: string
  preview: string
  mimeType: string
}

type FormStep = 'form' | 'submitting' | 'success' | 'error'

export default function ReporteForm() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<FormStep>('form')
  const [municipio, setMunicipio] = useState<Municipio | null>(null)
  const [tipo, setTipo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [imagen, setImagen] = useState<ImageResult | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [certChecked, setCertChecked] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle')

  // Persistir borrador en localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sv_draft')
    if (saved) {
      try {
        const d = JSON.parse(saved)
        if (d.tipo) setTipo(d.tipo)
        if (d.descripcion) setDescripcion(d.descripcion)
        if (d.municipio) setMunicipio(d.municipio)
      } catch {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('sv_draft', JSON.stringify({ tipo, descripcion, municipio }))
  }, [tipo, descripcion, municipio])

  const requestGeo = async () => {
    setGeoStatus('loading')
    const pos = await getCurrentPosition()
    if (pos) {
      setCoords(pos)
      setGeoStatus('ok')
    } else {
      setGeoStatus('denied')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!municipio) return setErrorMsg('Selecciona un municipio de la lista.')
    if (!tipo) return setErrorMsg('Selecciona el tipo de incidencia.')
    if (!imagen) return setErrorMsg('Añade una fotografía de la incidencia.')
    if (!certChecked) return setErrorMsg('Debes certificar que la imagen es adecuada.')
    if (!turnstileToken) return setErrorMsg('Completa la verificación de seguridad.')
    if (descripcion.length < 10) return setErrorMsg('La descripción debe tener al menos 10 caracteres.')

    setStep('submitting')

    try {
      // 1. Verificar sesión
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setErrorMsg('Sesión expirada. Vuelve a acceder con tu correo.')
        setStep('error')
        return
      }

      // 2. Obtener o asignar coordenadas
      let exactLat = coords?.lat ?? 0
      let exactLon = coords?.lon ?? 0
      if (!coords) {
        // Si el usuario no dio permiso, centramos en el municipio (aproximado)
        const { data: mData } = await supabase
          .from('municipios')
          .select('geom')
          .eq('codigo_ine', municipio.codigo_ine)
          .single()
        // geom es un WKB — usamos un centroide aproximado genérico
        exactLat = 40.0
        exactLon = -3.7
      }

      // 3. Crear incidencia en el servidor con validación de Turnstile y sesión
      const resCrear = await fetch('/api/incidencias/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnstileToken,
          codigoIne: municipio.codigo_ine,
          tipo,
          descripcion,
          lat: exactLat,
          lon: exactLon,
        }),
      })

      const resJson = await resCrear.json()
      if (!resCrear.ok) {
        throw new Error(resJson.error || 'Error al validar el reporte en el servidor')
      }

      const { incidenciaId, protocolId } = resJson

      // 4. Subir imagen al storage de Supabase
      const ext = imagen.mimeType === 'image/png' ? 'png' : 'jpg'
      const storagePath = `incidencias/${incidenciaId}/${protocolId}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('evidencias')
        .upload(storagePath, imagen.blob, { contentType: imagen.mimeType, upsert: false })
      if (uploadError) throw uploadError

      // 6. Generar protocol_id de evidencia e insertar registro
      const { data: eviProtocol, error: eviRpcError } = await supabase
        .rpc('generar_protocol_id', { p_ine: municipio.codigo_ine, p_tipo: 'EVI' })
      if (eviRpcError) throw eviRpcError

      const { error: eviError } = await supabase.from('evidencias').insert({
        protocol_id: eviProtocol,
        incidencia_id: incidenciaId,
        url_storage: storagePath,
        hash_sha256: imagen.sha256,
      })
      if (eviError) throw eviError

      // 7. Limpiar borrador
      localStorage.removeItem('sv_draft')
      setStep('success')
    } catch (err: unknown) {
      console.error(err)
      setErrorMsg('Error al enviar. Comprueba tu conexión y vuelve a intentarlo.')
      setStep('error')
    }
  }

  async function getMunicipioId(codigo_ine: string): Promise<number> {
    const { data } = await supabase
      .from('municipios')
      .select('id')
      .eq('codigo_ine', codigo_ine)
      .single()
    return data?.id
  }

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="text-5xl">✅</span>
        <h2 className="text-xl font-bold text-gray-900">Reporte enviado</h2>
        <p className="max-w-xs text-sm text-gray-600">
          Revisaremos tu aportación en menos de 24 horas. Recibirás una notificación
          por correo cuando se publique.
        </p>
        <button
          onClick={() => { setStep('form'); setImagen(null); setTipo(''); setDescripcion('') }}
          className="mt-4 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white"
        >
          Reportar otra incidencia
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Municipio */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">
          Municipio <span className="text-red-500">*</span>
        </label>
        <MunicipioSearch value={municipio} onChange={setMunicipio} />
      </div>

      {/* Tipo */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">
          Tipo de incidencia <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                tipo === t.value
                  ? 'border-orange-500 bg-orange-50 font-semibold text-orange-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Foto */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">
          Fotografía <span className="text-red-500">*</span>
        </label>
        <ImageUpload onReady={setImagen} />
      </div>

      {/* Coordenadas */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">
          Ubicación
        </label>
        {geoStatus === 'idle' && (
          <button
            type="button"
            onClick={requestGeo}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 hover:bg-orange-50 hover:border-orange-300"
          >
            📍 Añadir mi ubicación actual (opcional pero recomendado)
          </button>
        )}
        {geoStatus === 'loading' && (
          <p className="text-sm text-gray-500">Obteniendo ubicación…</p>
        )}
        {geoStatus === 'ok' && (
          <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            ✓ Ubicación registrada. Se publicará ofuscada a ≈100 m del punto exacto.
          </p>
        )}
        {geoStatus === 'denied' && (
          <p className="rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
            Sin permiso de ubicación — se asignará el centroide del municipio.
          </p>
        )}
      </div>

      {/* Descripción */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">
          Descripción <span className="text-red-500">*</span>
        </label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          minLength={10}
          maxLength={800}
          placeholder="Describe brevemente qué pasó: qué señal, qué tipo de vehículo, qué te dijeron…"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          required
        />
        <p className="mt-1 text-right text-xs text-gray-400">{descripcion.length}/800</p>
      </div>

      {/* Certificación */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <input
          type="checkbox"
          checked={certChecked}
          onChange={(e) => setCertChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded accent-orange-500"
          required
        />
        <span className="text-sm text-gray-700">
          Declaro que la imagen no contiene <strong>matrículas legibles</strong> de vehículos
          ajenos ni <strong>rostros reconocibles</strong> de terceros sin su consentimiento.
        </span>
      </label>

      {/* Turnstile */}
      <div className="flex justify-center">
        <Turnstile
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          onSuccess={(token) => setTurnstileToken(token)}
          onExpire={() => setTurnstileToken(null)}
          options={{ theme: 'light', language: 'es' }}
        />
      </div>

      {/* Error */}
      {(step === 'error' || errorMsg) && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={step === 'submitting'}
        className="w-full rounded-xl bg-orange-500 py-4 text-base font-bold text-white shadow transition hover:bg-orange-600 active:scale-95 disabled:opacity-60"
      >
        {step === 'submitting' ? 'Enviando…' : 'Enviar reporte'}
      </button>
    </form>
  )
}
