# Plataforma de Defensa del Caravaning (España)

Infraestructura abierta para detectar, documentar y combatir restricciones injustificadas al caravaning en municipios de España.

## Arquitectura

- `web/`: Aplicación frontend en Next.js (App Router), MapLibre y panel de moderación.
- `engine/`: Radar normativo, prefiltro regex, triaje y análisis con LLM en Python.
- `supabase/`: Migraciones y configuración de Postgres/PostGIS local y en la nube.
- `docs/`: Documentación legal, criterios de verificación y especificación del protocolo de identificadores.

## Arranque local

### Requisitos
- Docker Desktop activo
- Node.js 20+
- Python 3.12+

### Base de datos (Supabase local)
```bash
npm run db:start
npm run db:reset
```

## Licencia

GNU Affero General Public License v3.0 (AGPL-3.0). Ver [LICENSE](LICENSE).
