'use client'

import { useState, useEffect } from 'react'

interface NodeItem {
  id: number
  ine: string
  nombre: string
  provincia: string
  conexiones: number
}

interface LinkItem {
  id: string
  source: number
  target: number
  source_name: string
  target_name: string
  porcentaje: number
  fragmentos: string[]
  posible_redactor: string
}

export default function ContagioNormativoPage() {
  const [nodes, setNodes] = useState<NodeItem[]>([])
  const [links, setLinks] = useState<LinkItem[]>([])
  const [selectedLink, setSelectedLink] = useState<LinkItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/inteligencia/contagio')
      .then((res) => res.json())
      .then((data) => {
        setNodes(data.nodes || [])
        setLinks(data.links || [])
        if (data.links && data.links.length > 0) {
          setSelectedLink(data.links[0])
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  // Coordenadas calculadas en disposición radial para el SVG
  const width = 600
  const height = 400
  const centerX = width / 2
  const centerY = height / 2
  const radius = 140

  const nodePositions: Record<number, { x: number; y: number }> = {}
  nodes.forEach((node, idx) => {
    const angle = (idx / (nodes.length || 1)) * 2 * Math.PI - Math.PI / 2
    nodePositions[node.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    }
  })

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Cabecera */}
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-wider text-red-600">
          Inteligencia Normativa · Detección n-gram
        </span>
        <h1 className="mt-1 text-3xl font-black text-gray-900">
          Grafo de Contagio y Copypaste Intermunicipal
        </h1>
        <p className="mt-2 text-sm text-gray-600 max-w-2xl">
          Identificamos mediante análisis algorítmico de similitud qué ayuntamientos copian literalmente los textos de sus ordenanzas de otros municipios o externalizan su redacción a la misma consultora sin estudio técnico previo.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">
          <span className="text-3xl animate-bounce">🕸️</span>
          <p className="mt-2 font-medium">Analizando relaciones de similitud intermunicipal…</p>
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <span className="text-5xl">🌱</span>
          <h3 className="mt-3 text-lg font-bold text-gray-900">No hay clústeres detectados todavía</h3>
          <p className="mt-1 text-xs text-gray-500">
            A medida que el radar incorpore más ordenanzas se rastrearán patrones de plagio cruzado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Grafo SVG Interactivo */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-7 flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-xs text-gray-500 mb-2">
              <span className="font-bold text-gray-700">Red de contagio detectada</span>
              <span>{nodes.length} municipios · {links.length} vínculos</span>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-w-lg">
              {/* Líneas / Enlaces de contagio */}
              {links.map((link) => {
                const p1 = nodePositions[link.source]
                const p2 = nodePositions[link.target]
                if (!p1 || !p2) return null
                const isSelected = selectedLink?.id === link.id

                return (
                  <line
                    key={link.id}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={isSelected ? '#dc2626' : '#f97316'}
                    strokeWidth={isSelected ? 4 : 2}
                    strokeDasharray={isSelected ? 'none' : '4 4'}
                    className="cursor-pointer transition-all duration-300 hover:stroke-red-600 hover:stroke-width-4"
                    onClick={() => setSelectedLink(link)}
                  />
                )
              })}

              {/* Nodos de Municipios */}
              {nodes.map((node) => {
                const pos = nodePositions[node.id]
                if (!pos) return null
                const isConnected = selectedLink && (selectedLink.source === node.id || selectedLink.target === node.id)

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    onClick={() => {
                      const found = links.find((l) => l.source === node.id || l.target === node.id)
                      if (found) setSelectedLink(found)
                    }}
                  >
                    <circle
                      r={isConnected ? 22 : 18}
                      fill={isConnected ? '#ea580c' : '#ffffff'}
                      stroke={isConnected ? '#9a3412' : '#ea580c'}
                      strokeWidth={3}
                      className="transition-all duration-300 shadow"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fontSize="10"
                      fontWeight="bold"
                      fill={isConnected ? '#ffffff' : '#9a3412'}
                    >
                      {node.nombre.substring(0, 3).toUpperCase()}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="32"
                      fontSize="11"
                      fontWeight="bold"
                      fill="#111827"
                    >
                      {node.nombre}
                    </text>
                  </g>
                )
              })}
            </svg>
            <p className="mt-2 text-[11px] text-gray-400 text-center">
              Haz clic sobre un municipio o línea discontinua para inspeccionar la cláusula compartida.
            </p>
          </div>

          {/* Panel Inspector de Cláusula Copiada */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-5 flex flex-col justify-between">
            {selectedLink ? (
              <div>
                <div className="flex items-center justify-between border-b pb-3">
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-800">
                    🚨 {selectedLink.porcentaje}% de coincidencia
                  </span>
                  <span className="text-xs text-gray-400 font-mono">Copypaste verificado</span>
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-bold text-gray-900">
                    {selectedLink.source_name} ↔ {selectedLink.target_name}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedLink.posible_redactor}
                  </p>
                </div>

                <div className="mt-5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Fragmento idéntico detectado:
                  </label>
                  <div className="mt-2 rounded-2xl border border-red-200 bg-red-50/60 p-4 text-xs leading-relaxed text-red-950 font-mono">
                    {selectedLink.fragmentos.length > 0 ? (
                      selectedLink.fragmentos.map((frag, idx) => (
                        <p key={idx} className="mb-2 last:mb-0">
                          «{frag}»
                        </p>
                      ))
                    ) : (
                      <p>Estructura gramatical y sintáctica idéntica de prohibición general de pernocta.</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs text-amber-900 leading-snug border border-amber-200">
                  <strong>Impacto jurídico para tu alegación o recurso:</strong>
                  <p className="mt-1 text-amber-800">
                    Demostrar que el Ayuntamiento utilizó una plantilla clonada de otro consistorio sin informe técnico motivado destruye la justificación exigida por el artículo 84 de la LRBRL y el principio de proporcionalidad.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-10">
                Selecciona una conexión en el grafo para inspeccionar el informe de contagio.
              </p>
            )}

            <div className="mt-6 border-t pt-4 flex gap-2">
              <a
                href="/mapa"
                className="flex-1 text-center rounded-xl border border-gray-300 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Ver en el Mapa
              </a>
              <a
                href="/mis-acciones"
                className="flex-1 text-center rounded-xl bg-orange-600 py-2 text-xs font-bold text-white shadow hover:bg-orange-700"
              >
                Impugnar con este indicio
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
