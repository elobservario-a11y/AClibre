import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = { title: 'Baja de Alertas — Slowvan' }

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function BajaAlertasPage({ searchParams }: PageProps) {
  const { token } = await searchParams
  let dadaDeBaja = false

  if (token && typeof token === 'string' && token.trim().length > 0) {
    const supabase = createAdminClient()
    const { data: cancelada, error } = await supabase.rpc('cancelar_suscripcion_alerta', {
      p_token: token.trim(),
    })

    if (!error && cancelada) dadaDeBaja = true
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      {dadaDeBaja ? (
        <div className="rounded-3xl border border-green-200 bg-green-50 p-8 shadow-sm">
          <span className="text-5xl">✓</span>
          <h1 className="mt-4 text-2xl font-black text-green-900">Baja confirmada</h1>
          <p className="mt-2 text-sm text-green-800">
            Tu suscripción de alertas ha sido desactivada. No volverás a recibir notificaciones.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-xl bg-green-700 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-green-800"
          >
            Volver al inicio
          </a>
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <span className="text-5xl">⚠️</span>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Enlace no válido o expirado</h1>
          <p className="mt-2 text-sm text-gray-500">
            No se ha encontrado ninguna suscripción activa asociada a este identificador.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-orange-600"
          >
            Volver al inicio
          </a>
        </div>
      )}
    </main>
  )
}
