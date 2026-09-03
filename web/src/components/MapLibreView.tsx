'use client'

import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface MapIncidencia {
  id: string
  protocol_id: string
  tipo: string
  descripcion: string
  lon: number
  lat: number
  municipio: {
    codigo_ine: string
    nombre: string
    provincia: string
  }
}

const TIPO_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  senal_ilegal: { color: '#ef4444', label: 'Señal ilegal', icon: '🚫' },
  multa: { color: '#f97316', label: 'Multa', icon: '📄' },
  desalojo: { color: '#a855f7', label: 'Desalojo', icon: '🚨' },
  bloqueo_acceso: { color: '#eab308', label: 'Bloqueo acceso', icon: '🚧' },
}

export default function MapLibreView({ incidencias }: { incidencias: MapIncidencia[] }) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [-3.7038, 40.2], // Centro aproximado de la Península
      zoom: 5.6,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map

    // Añadir marcadores para cada incidencia aprobada
    incidencias.forEach((inc) => {
      const cfg = TIPO_CONFIG[inc.tipo] || { color: '#ea580c', label: inc.tipo, icon: '📍' }

      // Elemento HTML personalizado para el marcador
      const el = document.createElement('div')
      el.className = 'cursor-pointer flex items-center justify-center rounded-full shadow-lg border-2 border-white transition-transform hover:scale-125'
      el.style.backgroundColor = cfg.color
      el.style.width = '32px'
      el.style.height = '32px'
      el.style.fontSize = '16px'
      el.innerText = cfg.icon

      const popupContent = `
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 4px;">
          <div style="font-weight: 700; color: #111; margin-bottom: 2px;">
            ${cfg.icon} ${cfg.label}
          </div>
          <div style="font-weight: 600; color: #ea580c;">
            ${inc.municipio.nombre} <span style="color: #888; font-weight: 400;">(${inc.municipio.provincia})</span>
          </div>
          <div style="color: #444; margin-top: 4px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
            ${inc.descripcion}
          </div>
          <div style="margin-top: 8px; font-size: 11px; color: #888;">
            Ubicación aprox. (~100m) · ID: ${inc.protocol_id}
          </div>
          <div style="margin-top: 8px;">
            <a href="/municipio/${inc.municipio.codigo_ine}" style="color: #ea580c; font-weight: 700; text-decoration: underline;">
              Ver ficha de ${inc.municipio.nombre} →
            </a>
          </div>
        </div>
      `

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupContent)

      new maplibregl.Marker({ element: el })
        .setLngLat([inc.lon, inc.lat])
        .setPopup(popup)
        .addTo(map)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [incidencias])

  return (
    <div className="relative h-[calc(100vh-140px)] w-full overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  )
}
