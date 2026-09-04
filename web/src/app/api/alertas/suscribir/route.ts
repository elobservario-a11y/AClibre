import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verificarTurnstile } from '@/lib/turnstile'

// Validación de correo razonable: sin espacios, un solo @, dominio con punto.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(request: Request) {
  try {
    const { email, municipioId, provincia, turnstileToken } = await request.json()

    // 1. Antibot obligatorio. Este endpoint no exige sesión, así que Turnstile
    //    es lo único que impide dar de alta correos ajenos de forma masiva.
    const verificacion = await verificarTurnstile(turnstileToken)
    if (!verificacion.ok) {
      return NextResponse.json({ error: verificacion.motivo }, { status: verificacion.status })
    }

    // 2. Validación del correo
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) || email.length > 254) {
      return NextResponse.json({ error: 'Dirección de correo no válida' }, { status: 400 })
    }
    const emailNormalizado = email.trim().toLowerCase()

    const supabase = createAdminClient()

    // 3. Tope por correo: evita que una sola dirección acumule suscripciones sin fin.
    const { count: suscripcionesActivas } = await supabase
      .from('suscripciones_alertas')
      .select('*', { count: 'exact', head: true })
      .eq('email', emailNormalizado)
      .eq('activa', true)

    if ((suscripcionesActivas || 0) >= 30) {
      return NextResponse.json(
        { error: 'Has alcanzado el máximo de alertas activas para este correo.' },
        { status: 429 }
      )
    }

    // 4. Alta o reactivación
    // Ojo: `.eq('municipio_id', null)` NO casa con un NULL de SQL, así que las
    // suscripciones provinciales (sin municipio) nunca se deduplicaban y se
    // insertaba una fila por cada envío, multiplicando los correos de alerta.
    let consulta = supabase
      .from('suscripciones_alertas')
      .select('id, activa')
      .eq('email', emailNormalizado)

    consulta = municipioId
      ? consulta.eq('municipio_id', municipioId)
      : consulta.is('municipio_id', null)

    const { data: existente } = await consulta.maybeSingle()

    if (existente) {
      if (!existente.activa) {
        await supabase
          .from('suscripciones_alertas')
          .update({ activa: true })
          .eq('id', existente.id)
      }
      // Respuesta idéntica exista o no la suscripción: no revelamos a un tercero
      // si un correo concreto ya estaba dado de alta.
      return NextResponse.json({ ok: true })
    }

    const { error } = await supabase.from('suscripciones_alertas').insert({
      email: emailNormalizado,
      municipio_id: municipioId || null,
      provincia: provincia || null,
      activa: true,
    })

    if (error) {
      console.error('Error al crear la suscripción:', error.message)
      return NextResponse.json({ error: 'No se pudo activar la alerta' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
