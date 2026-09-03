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
