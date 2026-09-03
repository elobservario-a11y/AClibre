'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AccesoPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/confirm`
        : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/confirm`

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (authError) {
      setError('Error al enviar el enlace. Comprueba el correo e inténtalo de nuevo.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <main className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 py-16 text-center">
        <span className="text-5xl">📬</span>
        <h2 className="text-xl font-bold text-gray-900">Revisa tu correo</h2>
        <p className="text-sm text-gray-600">
          Hemos enviado un enlace de acceso a <strong>{email}</strong>. Caduca en 1 hora.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Acceder</h1>
      <p className="mb-6 text-sm text-gray-600">
        Sin contraseña. Te enviamos un enlace de acceso a tu correo.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          required
          autoFocus
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? 'Enviando…' : 'Enviar enlace de acceso'}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-gray-400">
        Al acceder aceptas los{' '}
        <a href="/terminos" className="underline">Términos de uso</a> y la{' '}
        <a href="/privacidad" className="underline">Política de privacidad</a>.
      </p>
    </main>
  )
}
