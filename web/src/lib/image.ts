/**
 * Elimina metadatos EXIF de una imagen mediante recodificación en canvas.
 * Opera enteramente en el navegador, antes de cualquier transmisión al servidor.
 * Devuelve el Blob limpio y su hash SHA-256.
 */
export async function stripExifAndHash(
  file: File,
  quality = 0.88
): Promise<{ blob: Blob; sha256: string; mimeType: string }> {
  const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'

  // Cargar imagen en un elemento HTML img
  const imageBitmap = await createImageBitmap(file)

  // Dibujar en canvas — esto descarta todos los metadatos EXIF
  const canvas = document.createElement('canvas')
  canvas.width = imageBitmap.width
  canvas.height = imageBitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(imageBitmap, 0, 0)
  imageBitmap.close()

  // Exportar como Blob sin metadatos
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob falló'))),
      mimeType,
      quality
    )
  })

  // Calcular SHA-256 con Web Crypto API (sin dependencias externas)
  const arrayBuffer = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const sha256 = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return { blob, sha256, mimeType }
}
