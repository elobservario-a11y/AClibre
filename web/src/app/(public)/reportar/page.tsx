import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReporteForm from '@/components/ReporteForm'

export const metadata = { title: 'Reportar incidencia — Slowvan' }

export default async function ReportarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/acceso?next=/reportar')

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reportar incidencia</h1>
        <p className="mt-1 text-sm text-gray-600">
          Cuatro campos y una foto. Todo lo demás se gestiona automáticamente.
        </p>
      </div>
      <ReporteForm />
    </main>
  )
}
