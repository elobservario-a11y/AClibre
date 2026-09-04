/**
 * Verificación de Cloudflare Turnstile en servidor.
 *
 * Reglas de diseño:
 *  - Falla cerrado. Si en producción no hay secreto configurado, la petición se
 *    rechaza. Antes se envolvía la comprobación en `if (secret)`, de modo que
 *    olvidar la variable de entorno desactivaba el antibot en silencio.
 *  - Rechaza en producción las claves de prueba de Cloudflare, que validan
 *    siempre y dejan el formulario abierto a cualquier bot.
 *  - En desarrollo se permite seguir sin secreto para no bloquear el trabajo local.
 */

// Claves de prueba documentadas por Cloudflare: validan (o rechazan) siempre.
const CLAVES_DE_PRUEBA = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
])

export type ResultadoTurnstile =
  | { ok: true }
  | { ok: false; motivo: string; status: 400 | 403 | 503 }

export async function verificarTurnstile(token: unknown): Promise<ResultadoTurnstile> {
  const enProduccion = process.env.NODE_ENV === 'production'
  const secreto = process.env.TURNSTILE_SECRET_KEY

  if (!secreto) {
    if (enProduccion) {
      console.error('TURNSTILE_SECRET_KEY no está configurada: se rechaza la petición')
      return { ok: false, motivo: 'La verificación de seguridad no está disponible ahora mismo.', status: 503 }
    }
    return { ok: true } // Solo en desarrollo local
  }

  if (enProduccion && CLAVES_DE_PRUEBA.has(secreto)) {
    console.error('TURNSTILE_SECRET_KEY es una clave de prueba de Cloudflare: no protege nada en producción')
    return { ok: false, motivo: 'La verificación de seguridad no está configurada correctamente.', status: 503 }
  }

  if (!token || typeof token !== 'string') {
    return { ok: false, motivo: 'Completa la verificación de seguridad.', status: 400 }
  }

  try {
    const cuerpo = new URLSearchParams({ secret: secreto, response: token })
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo.toString(),
    })
    const datos = await res.json()

    if (!datos.success) {
      return { ok: false, motivo: 'Verificación de seguridad fallida. Vuelve a intentarlo.', status: 403 }
    }
    return { ok: true }
  } catch (err) {
    // Un fallo de red contra Cloudflare no debe convertirse en una puerta abierta.
    console.error('Error contactando con Turnstile:', err)
    return { ok: false, motivo: 'No se pudo completar la verificación de seguridad. Inténtalo de nuevo.', status: 503 }
  }
}
