import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { email, municipioId, provincia } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Dirección de correo no válida' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Insertar o reactivar suscripción
    const { data: existing } = await supabase
      .from('suscripciones_alertas')
      .select('id, activa')
      .eq('email', email.trim().toLowerCase())
      .eq('municipio_id', municipioId || null)
      .single()

    if (existing) {
      if (!existing.activa) {
        await supabase
          .from('suscripciones_alertas')
          .update({ activa: true })
          .eq('id', existing.id)
      }
      return NextResponse.json({ ok: true, message: 'Suscripción activa' })
    }

    const { error } = await supabase.from('suscripciones_alertas').insert({
      email: email.trim().toLowerCase(),
      municipio_id: municipioId || null,
      provincia: provincia || null,
      activa: true,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
