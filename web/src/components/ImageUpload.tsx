'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { stripExifAndHash } from '@/lib/image'

interface ImageResult {
  blob: Blob
  sha256: string
  preview: string
  mimeType: string
}

export default function ImageUpload({
  onReady,
}: {
  onReady: (result: ImageResult | null) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Solo se aceptan imágenes (JPG, PNG, HEIC).')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('El fichero supera los 20 MB.')
      return
    }
    setProcessing(true)
    try {
      const { blob, sha256, mimeType } = await stripExifAndHash(file)
      const previewUrl = URL.createObjectURL(blob)
      setPreview(previewUrl)
      onReady({ blob, sha256, preview: previewUrl, mimeType })
    } catch (e) {
      setError('Error procesando la imagen. Inténtalo de nuevo.')
      onReady(null)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {preview ? (
        <div className="relative">
          <div className="relative h-48 w-full overflow-hidden rounded-xl">
            <Image src={preview} alt="Vista previa" fill className="object-cover" />
          </div>
          <button
            type="button"
            onClick={() => {
              setPreview(null)
              onReady(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-8 text-sm text-gray-500 transition hover:border-orange-400 hover:bg-orange-50 disabled:opacity-50"
        >
          {processing ? (
            <>
              <span className="text-2xl">⏳</span>
              <span>Procesando imagen…</span>
            </>
          ) : (
            <>
              <span className="text-3xl">📷</span>
              <span className="font-medium">Toca para hacer una foto o elegir de galería</span>
              <span className="text-xs text-gray-400">Los metadatos EXIF y GPS se eliminan automáticamente</span>
            </>
          )}
        </button>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
