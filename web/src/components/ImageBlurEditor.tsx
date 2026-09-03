'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface ImageBlurEditorProps {
  imageUrl: string
  onSave: (retouchedBlob: Blob, newSha256: string) => void
  onCancel: () => void
}

export default function ImageBlurEditor({ imageUrl, onSave, onCancel }: ImageBlurEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [history, setHistory] = useState<ImageData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cargar imagen en el canvas
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)])
      setLoading(false)
    }
    img.onerror = () => {
      setError('No se pudo cargar la imagen para retoque.')
      setLoading(false)
    }
  }, [imageUrl])

  // Obtener coordenadas relativas al canvas
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoords(e)
    setStartPos(pos)
    setIsDrawing(true)
  }

  const applyPixelate = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const x = Math.max(0, Math.min(x1, x2))
    const y = Math.max(0, Math.min(y1, y2))
    const w = Math.min(canvas.width - x, Math.abs(x2 - x1))
    const h = Math.min(canvas.height - y, Math.abs(y2 - y1))

    if (w < 8 || h < 8) return

    // Guardar estado previo para Deshacer
    setHistory((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)])

    // Efecto pixelado / difuminado intensivo
    const pixelSize = Math.max(12, Math.floor(Math.min(w, h) / 6))
    const imgData = ctx.getImageData(x, y, w, h)
    const data = imgData.data

    for (let py = 0; py < h; py += pixelSize) {
      for (let px = 0; px < w; px += pixelSize) {
        let r = 0, g = 0, b = 0, count = 0
        for (let dy = 0; dy < pixelSize && py + dy < h; dy++) {
          for (let dx = 0; dx < pixelSize && px + dx < w; dx++) {
            const index = ((py + dy) * w + (px + dx)) * 4
            r += data[index]
            g += data[index + 1]
            b += data[index + 2]
            count++
          }
        }
        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)

        for (let dy = 0; dy < pixelSize && py + dy < h; dy++) {
          for (let dx = 0; dx < pixelSize && px + dx < w; dx++) {
            const index = ((py + dy) * w + (px + dx)) * 4
            data[index] = r
            data[index + 1] = g
            data[index + 2] = b
          }
        }
      }
    }
    ctx.putImageData(imgData, x, y)
  }, [])

  const handleEnd = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return
    setIsDrawing(false)
    const endPos = getCanvasCoords(e)
    applyPixelate(startPos.x, startPos.y, endPos.x, endPos.y)
    setStartPos(null)
  }

  const handleUndo = () => {
    if (history.length <= 1) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const newHistory = [...history]
    newHistory.pop() // Quitar actual
    const previousState = newHistory[newHistory.length - 1]
    ctx.putImageData(previousState, 0, 0)
    setHistory(newHistory)
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const arrayBuffer = await blob.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const sha256 = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      onSave(blob, sha256)
    }, 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-3 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div>
          <h3 className="text-base font-bold">Herramienta de Difuminado</h3>
          <p className="text-xs text-gray-400">Arrastra un recuadro sobre la matrícula o cara para pixelarla</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length <= 1}
            className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-semibold hover:bg-gray-700 disabled:opacity-30"
          >
            ↩ Deshacer
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-semibold hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-orange-500"
          >
            ✓ Guardar retoque
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative flex flex-1 items-center justify-center overflow-auto py-2">
        {loading && <p className="text-sm text-gray-400">Cargando imagen…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseUp={handleEnd}
          onTouchStart={handleStart}
          onTouchEnd={handleEnd}
          className="max-h-full max-w-full cursor-crosshair touch-none rounded shadow-lg"
          style={{ display: loading || error ? 'none' : 'block' }}
        />
      </div>
    </div>
  )
}
