import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)
const PROTOCOL_REGEX = /^ES-MU-\d{5}-[A-Z]{3}-\d{4}-\d+$/

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { protocolId, nombre, dni, domicilio, email } = body

    if (!protocolId || typeof protocolId !== 'string' || !PROTOCOL_REGEX.test(protocolId)) {
      return NextResponse.json({ error: 'protocolId no válido o con formato incorrecto' }, { status: 400 })
    }

    // Ruta temporal para generar el archivo
    const tmpFile = path.join(os.tmpdir(), `alegacion_${protocolId}_${Date.now()}.pdf`)
    const scriptPath = path.join(process.cwd(), '..', 'engine', 'generator', 'allegations.py')

    const safeNombre = String(nombre || '[NOMBRE Y APELLIDOS]').slice(0, 150)
    const safeDni = String(dni || '[DNI/NIE]').slice(0, 20)
    const safeDomicilio = String(domicilio || '[DOMICILIO]').slice(0, 200)
    const safeEmail = String(email || 'info@slowvan.com').slice(0, 100)

    // Acepta ambos nombres: el entorno de despliegue puede tener configurado cualquiera de los dos
    const generatorUrl = process.env.PDF_GENERATOR_URL || process.env.GENERATOR_SERVICE_URL
    const internalToken = process.env.INTERNAL_GENERATOR_TOKEN

    // En producción el fallback local a Python no existe: fallar con un mensaje claro
    if (!generatorUrl && process.env.NODE_ENV === 'production') {
      console.error('Falta PDF_GENERATOR_URL / GENERATOR_SERVICE_URL en el entorno de producción')
      return NextResponse.json(
        { error: 'El servicio de generación de documentos no está configurado. Inténtalo de nuevo más tarde.' },
        { status: 503 }
      )
    }

    // Modo 1: Microservicio Python remoto si está configurado
    if (generatorUrl) {
      try {
        const remoteRes = await fetch(`${generatorUrl.replace(/\/$/, '')}/generar/alegacion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(internalToken ? { 'X-Internal-Token': internalToken } : {}),
          },
          body: JSON.stringify({
            protocolId,
            nombre: safeNombre,
            dni: safeDni,
            domicilio: safeDomicilio,
            email: safeEmail,
          }),
        })

        if (!remoteRes.ok) {
          const errData = await remoteRes.json().catch(() => ({}))
          return NextResponse.json(
            { error: errData.detail || 'El servicio generador de alegaciones no pudo completar la solicitud' },
            { status: remoteRes.status === 404 ? 404 : 502 }
          )
        }

        const pdfBuffer = await remoteRes.arrayBuffer()

        return new Response(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Alegaciones_${protocolId}.pdf"`,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        })
      } catch (fetchErr) {
        console.error('Error conectando con el microservicio generador:', fetchErr)
        return NextResponse.json(
          { error: 'El servicio de generación de documentos no está disponible en este momento. Inténtalo de nuevo en unos minutos.' },
          { status: 503 }
        )
      }
    }

    // Modo 2: Fallback local para desarrollo con Python local
    await execFileAsync('python', [
      scriptPath,
      '--protocol', protocolId,
      '--nombre', safeNombre,
      '--dni', safeDni,
      '--domicilio', safeDomicilio,
      '--email', safeEmail,
      '--out', tmpFile,
    ])

    if (!fs.existsSync(tmpFile)) {
      return NextResponse.json({ error: 'No se pudo generar el documento PDF' }, { status: 500 })
    }

    const pdfBuffer = fs.readFileSync(tmpFile)
    fs.unlinkSync(tmpFile) // Limpiar temporal

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Alegaciones_${protocolId}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('Error generando alegación:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
