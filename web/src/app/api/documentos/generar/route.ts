import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

const SCRIPT_MAP: Record<string, string> = {
  alegacion: 'allegations.py',
  reposicion: 'recurso_reposicion.py',
  transparencia: 'solicitud_transparencia.py',
}

const PREFIX_MAP: Record<string, string> = {
  alegacion: 'Alegaciones',
  reposicion: 'Recurso_Reposicion',
  transparencia: 'Solicitud_Transparencia',
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tipoDocumento = 'alegacion', protocolId, nombre, dni, domicilio, email } = body

    if (!protocolId) {
      return NextResponse.json({ error: 'Falta protocolId' }, { status: 400 })
    }

    const scriptFile = SCRIPT_MAP[tipoDocumento] || 'allegations.py'
    const scriptPath = path.join(process.cwd(), '..', 'engine', 'generator', scriptFile)

    const tmpFile = path.join(os.tmpdir(), `${tipoDocumento}_${protocolId}_${Date.now()}.pdf`)

    const safeNombre = (nombre || '[NOMBRE Y APELLIDOS]').replace(/"/g, '\\"')
    const safeDni = (dni || '[DNI/NIE]').replace(/"/g, '\\"')
    const safeDomicilio = (domicilio || '[DOMICILIO]').replace(/"/g, '\\"')
    const safeEmail = (email || 'info@slowvan.com').replace(/"/g, '\\"')

    const cmd = `python "${scriptPath}" --protocol "${protocolId}" --nombre "${safeNombre}" --dni "${safeDni}" --domicilio "${safeDomicilio}" --email "${safeEmail}" --out "${tmpFile}"`

    await execAsync(cmd)

    if (!fs.existsSync(tmpFile)) {
      return NextResponse.json({ error: 'No se pudo generar el documento administrativo en PDF' }, { status: 500 })
    }

    const pdfBuffer = fs.readFileSync(tmpFile)
    fs.unlinkSync(tmpFile)

    const prefix = PREFIX_MAP[tipoDocumento] || 'Documento'

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${prefix}_${protocolId}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('Error generando documento:', err)
    return NextResponse.json({ error: err.message || 'Error del servidor' }, { status: 500 })
  }
}
