# Especificación del Protocolo de Identificadores (Caravaning Rights Protocol v1)

## Formato Canónico
`ES-MU-{CODIGO_INE}-{TIPO}-{AÑO}-{SECUENCIAL_3D}`

Ejemplo: `ES-MU-13028-NOR-2026-001`

## Segmentos

| Segmento | Descripción | Ejemplo |
|---|---|---|
| `ES` | Código de país ISO 3166-1 alfa-2 | `ES` |
| `MU` | Ámbito municipal | `MU` |
| `{CODIGO_INE}` | Código INE oficial de 5 dígitos del municipio | `13028` (Daimiel) |
| `{TIPO}` | Tipo de entidad de tres letras | `NOR`, `INC`, `EVI`, `CAS`, `ACC`, `RES` |
| `{AÑO}` | Año de creación (4 dígitos) | `2026` |
| `{SECUENCIAL_3D}` | Correlativo atómico con padding a 3 dígitos (001, 002...) | `001` |

## Tipos de Entidad

- `NOR`: Norma / Ordenanza municipal detectada o analizada.
- `INC`: Incidencia ciudadana reportada.
- `EVI`: Evidencia documental o fotográfica asociada a una incidencia.
- `CAS`: Caso estratégico que agrupa norma e incidencias.
- `ACC`: Acción administrativa registrada por un ciudadano.
- `RES`: Resultado final del expediente administrativo.

## Reglas de Integridad
1. La secuencia numérica es independiente por tupla `(codigo_ine, tipo, anio)`.
2. La asignación se realiza mediante la función plpgsql `public.generar_protocol_id(p_ine, p_tipo)` garantizando atomicidad mediante `on conflict do update`.
3. Ningún identificador se reasigna ni reutiliza tras eliminación o rollback.
