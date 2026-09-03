/**
 * Añade un desplazamiento aleatorio de ≈100 metros a unas coordenadas.
 * 1 grado de latitud ≈ 111 km → 100 m ≈ 0.0009 grados.
 * 1 grado de longitud varía con la latitud: 100 m ≈ 0.0009 / cos(lat).
 * El resultado es la coordenada pública ofuscada que se almacena en geom_publica.
 */
export function obfuscateCoords(lat: number, lon: number): { lat: number; lon: number } {
  const OFFSET_DEG = 0.0009 // ≈ 100 m en latitud
  const deltaLat = (Math.random() - 0.5) * 2 * OFFSET_DEG
  const deltaLon = (Math.random() - 0.5) * 2 * (OFFSET_DEG / Math.cos((lat * Math.PI) / 180))
  return {
    lat: Math.round((lat + deltaLat) * 1e6) / 1e6,
    lon: Math.round((lon + deltaLon) * 1e6) / 1e6,
  }
}

/**
 * Solicita la geolocalización del dispositivo del usuario.
 * Devuelve null si el usuario deniega o el navegador no lo soporta.
 */
export function getCurrentPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: true }
    )
  })
}
