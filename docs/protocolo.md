# Protocolo Abierto de Federación Slowvan v1.0

**Responsable técnico**: Jose Montero — info@slowvan.com  
**Dominio canónico**: https://slowvan.com  
**Licencia**: AGPL-3.0  
**Versión del protocolo**: 1.0  
**Fecha**: 2026-09-03  

---

## 1. Propósito

El Protocolo Abierto de Federación Slowvan permite a cualquier plataforma, aplicación móvil, club o asociación de caravanistas enviar reportes verificados de incidencias al Radar Canónico de Slowvan. Estos reportes entran directamente en la cola de moderación para su validación y publicación en el mapa público.

Plataformas objetivo:
- Park4Night
- Caramaps
- FEAA (Federación Española de Asociaciones de Autocaravanistas)
- ASAC (Asociación de Autocaravanistas de Cataluña)
- Cualquier app que implemente el protocolo

---

## 2. Autenticación

El endpoint de federación no requiere cuenta de usuario. Cada nodo federado se identifica mediante un **`federation_token`** estático provisto por el responsable de Slowvan tras un acuerdo de colaboración.

Para solicitar un token de federación:
```
Email: info@slowvan.com
Asunto: Solicitud Token Federación Slowvan v1
```

---

## 3. Endpoint de Ingesta

```
POST https://slowvan.com/api/v1/federacion
Content-Type: application/json
```

### 3.1 Cuerpo de la solicitud (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Slowvan Federation Report v1",
  "type": "object",
  "required": ["federation_token", "fuente_nombre", "tipo", "descripcion", "lat", "lon"],
  "properties": {
    "federation_token": {
      "type": "string",
      "description": "Token secreto asignado al nodo federado"
    },
    "fuente_nombre": {
      "type": "string",
      "description": "Nombre del nodo emisor (ej: 'Park4Night', 'Caramaps', 'FEAA')"
    },
    "tipo": {
      "type": "string",
      "enum": ["senal_ilegal", "multa", "desalojo", "bloqueo_acceso"],
      "description": "Tipo canónico de la incidencia"
    },
    "descripcion": {
      "type": "string",
      "minLength": 20,
      "maxLength": 1000,
      "description": "Descripción del incidente verificada por el nodo emisor"
    },
    "lat": {
      "type": "number",
      "minimum": 35.0,
      "maximum": 44.5,
      "description": "Latitud WGS84 (territorio peninsular y balear)"
    },
    "lon": {
      "type": "number",
      "minimum": -9.5,
      "maximum": 4.5,
      "description": "Longitud WGS84"
    },
    "nivel_confianza": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5,
      "default": 2,
      "description": "Nivel de confianza del nodo emisor (1=mínimo, 5=máximo)"
    },
    "url_evidencia": {
      "type": "string",
      "format": "uri",
      "description": "URL pública de la incidencia original en la plataforma emisora (opcional)"
    },
    "fecha_incidencia_iso": {
      "type": "string",
      "format": "date-time",
      "description": "Fecha y hora UTC del incidente en formato ISO 8601 (opcional)"
    }
  }
}
```

### 3.2 Ejemplo de solicitud válida

```bash
curl -X POST https://slowvan.com/api/v1/federacion \
  -H "Content-Type: application/json" \
  -d '{
    "federation_token": "tok_xxxxxxxxxxxxx",
    "fuente_nombre": "Park4Night",
    "tipo": "senal_ilegal",
    "descripcion": "Señal de prohibición de estacionamiento de autocaravanas instalada sin homologación DGT en el acceso al paseo marítimo. Señal circular roja con pictograma de autocaravana.",
    "lat": 43.4612,
    "lon": -5.0586,
    "nivel_confianza": 3,
    "url_evidencia": "https://park4night.com/reports/12345"
  }'
```

### 3.3 Respuesta de éxito (HTTP 201)

```json
{
  "status": "created",
  "protocol_id": "ES-MU-33056-INC-2026-031",
  "message": "Reporte federado registrado en cola de moderación",
  "fuente": "Park4Night"
}
```

### 3.4 Códigos de error

| Código | Causa |
|--------|-------|
| `400` | Token inválido, coordenadas fuera de España, tipo no reconocido, descripción < 20 chars |
| `409` | Incidencia duplicada (mismas coordenadas ±100m e igual tipo en las últimas 24h) |
| `429` | Rate limit superado (máx. 100 reportes/hora por token) |

---

## 4. Garantías del protocolo

- **Privacidad**: Las coordenadas exactas son ofuscadas a ~100m antes de publicación pública.
- **Moderación**: Todo reporte federado entra en estado `pendiente` y requiere aprobación manual.
- **Atribución**: El campo `fuente_nombre` se muestra públicamente en la ficha de la incidencia.
- **Integridad**: Cada reporte recibe un `protocol_id` canónico trazable.
- **Open Data**: Una vez aprobado, el reporte se incluye en el export diario y la API v1.

---

## 5. Rate Limits por nivel de colaboración

| Nivel | Reportes/hora | Nivel de confianza inicial |
|-------|---------------|---------------------------|
| Básico (gratuito) | 20 | 2 |
| Colaborador (clubes/asociaciones) | 100 | 3 |
| Partner oficial (Park4Night, Caramaps) | 500 | 4 |

---

## 6. Changelog del protocolo

- **v1.0** (2026-09-03): Primera versión pública estable.
