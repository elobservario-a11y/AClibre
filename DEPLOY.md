# DEPLOY.md — Plan de despliegue a producción

> Estado de partida: P0/P1 cerrados y verificados (ver [FIXES.md](FIXES.md)), corpus y generadores saneados, build local limpio.
> Todavía **no hay nada desplegado**: sin proyecto en Supabase Cloud, sin proyecto en Vercel, sin dominio apuntado, sin secretos de producción.
> Antes de tocar Vercel hay **dos bloqueantes nuevos** encontrados al preparar este plan (D0). Sin resolverlos, el despliegue sale roto o inseguro por sesión.

---

## D0 — Dos bloqueantes que hay que cerrar antes de desplegar

### D0.1 — Los generadores de PDF no pueden correr en Vercel

`web/src/app/api/documentos/generar/route.ts` y `.../api/normas/alegacion/route.ts` invocan `execFile('python', [...])` sobre `engine/generator/*.py`, que a su vez abren una conexión directa a Postgres con `psycopg2` y componen el PDF con `reportlab`. Esto asume:
- un intérprete Python instalado en el mismo host que la app Next.js,
- acceso de red desde ese host a la base de datos,
- un sistema de ficheros persistente para escribir el PDF temporal.

Ninguna de las tres cosas existe en una función serverless de Vercel (Node.js, sin runtime Python, sin filesystem persistente entre invocaciones, cold start por request). Este endpoint devolverá `500` en cuanto se despliegue tal cual — no es un riesgo, es una certeza.

**Fix — extraer a microservicio Python independiente:**
1. Crear `engine/api/` con un wrapper mínimo en FastAPI (o Flask) que exponga:
   - `POST /generar/{alegacion|reposicion|transparencia}` con el mismo payload que hoy recibe `execFile` (protocolId, nombre, dni, domicilio, email), devolviendo el PDF como bytes.
2. Desplegar ese servicio en **Railway** o **Render** (free/hobby tier cubre esto de sobra): build automático desde `engine/`, variable `DATABASE_URL` apuntando a Supabase Cloud (connection string con pooler, puerto 6543, ver D1.3).
3. Sustituir en los dos endpoints de Next.js el `execFile` por un `fetch()` al microservicio, protegido con un header de secreto compartido (`X-Internal-Token`) para que no sea invocable directamente desde fuera.
4. Coste: 0 € en el tier gratuito de Railway/Render mientras el tráfico sea bajo; si se pasa al tier de pago, ronda 5 €/mes.

*Hecho cuando:* generar una alegación real desde `/municipio/[ine]` en el entorno de staging de Vercel produce un PDF descargable sin tocar el proceso Node.

### D0.2 — Sin `middleware.ts`, las sesiones de enlace mágico no se refrescan

No existe `web/src/middleware.ts`. El patrón de Supabase SSR para Next.js App Router necesita un middleware que llame a `supabase.auth.getUser()` en cada request para refrescar el token de sesión desde la cookie. Sin él, el access token expira (por defecto 1 h) y el usuario queda deslogueado a media sesión en `/mis-acciones` o `/admin`, de forma intermitente y difícil de reproducir en local porque en local se prueba poco rato seguido.

**Fix:** añadir `web/src/middleware.ts` con el patrón estándar de `@supabase/ssr` (`createServerClient` + `updateSession`), matcher excluyendo estáticos:

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
```

*Hecho cuando:* una sesión abierta por enlace mágico sigue activa después de 90 minutos de uso intermitente en staging.

---

## D1 — Supabase Cloud

### D1.1 — Crear el proyecto
- Nueva organización/proyecto en [supabase.com](https://supabase.com), región **Frankfurt (eu-central-1)** — obligatorio por RGPD, ya asumido en el plan original.
- Plan gratuito para arrancar (500 MB de BD, 1 GB de storage, 50k MAU de auth — de sobra para el objetivo de 50 aportaciones en 90 días). Guardar la contraseña de la base generada por Supabase en un gestor de contraseñas, no en texto plano.

### D1.2 — Aplicar el esquema
```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```
Esto aplica las 10 migraciones en orden (`0001` a `0010`). Verificar al final:
- `select count(*) from municipios;` → 8.132
- `select count(*) from fuentes;` → 52 (todas con `activo = false`, correcto por ahora)
- `select count(*) from casos;` → 0 (correcto, purgado)
- `select count(*) from efectividad_argumentos;` → 5, todas en `0/0/0`

### D1.3 — Connection string para el microservicio Python (D0.1)
Usar el **pooler de transacciones** (puerto 6543, modo `transaction`), no la conexión directa (5432) — Railway/Render abren y cierran conexiones por request y agotarían el límite de conexiones directas de Supabase en minutos. Se obtiene en *Project Settings → Database → Connection pooling*.

### D1.4 — Auth
- *Authentication → URL Configuration*: `Site URL` = dominio de producción; `Redirect URLs` = `https://<dominio>/auth/confirm`.
- *Authentication → Email Templates*: personalizar la plantilla de "Magic Link" — la de Supabase por defecto va en inglés y sin marca. Mínimo: asunto y remitente coherentes con el proyecto.
- Confirmar que el rate limit de envío de emails de Supabase (por defecto bajo en el plan gratuito) es compatible con el volumen esperado, o configurar SMTP propio con Resend (ver D5.1) desde ya para no depender del límite de Supabase.

### D1.5 — Storage
- Confirmar que el bucket `evidencias` (creado en la migración `0002`) existe y es privado.
- *Settings → Storage*: límite de tamaño por archivo (recomendado 8 MB, suficiente para una foto de móvil ya recomprimida en cliente).

---

## D2 — Dominio y Vercel

### D2.1 — Dominio
Pendiente desde el plan original (sprint 0.3). Sin nombre elegido, este paso no puede cerrarse. Recomendación ya dada: dominio institucional + dominio militante que redirige. Si sigue sin decidirse, **no bloquea** el resto de D2 — se puede desplegar primero sobre el dominio `*.vercel.app` de cortesía y apuntar el dominio propio después sin tocar nada más.

### D2.2 — Proyecto en Vercel
- Importar el repositorio de GitHub. **Root Directory: `web/`** (monorepo — Vercel necesita que se le diga explícitamente, si no intentará construir desde la raíz y fallará porque `package.json` está en `web/`).
- Framework preset: Next.js (autodetectado).
- Build command y output: por defecto.

### D2.3 — DNS
- Registro `A`/`CNAME` según indique Vercel al añadir el dominio custom.
- Esperar propagación (puede tardar hasta 24 h, normalmente minutos) antes de dar por cerrado D2.
- Verificar HTTPS automático (Vercel lo gestiona solo con Let's Encrypt).

---

## D3 — Variables de entorno de producción

En Vercel (*Project Settings → Environment Variables*), **Production** y **Preview** por separado si se quiere staging real (recomendado: usar un segundo proyecto Supabase para Preview, o al menos aislar los datos de prueba):

| Variable | Origen | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Cloud, Project Settings → API | Pública, va al cliente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Cloud, Project Settings → API | Pública, protegida por RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Cloud, Project Settings → API | **Server-only.** No marcar como pública. Rota si alguna vez se filtra. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare, nuevo widget en modo producción (no el de pruebas) | Pública |
| `TURNSTILE_SECRET_KEY` | Cloudflare, mismo widget | Server-only |
| `RESEND_API_KEY` | Resend | Server-only, para `engine/alerts/notifier.py` y opcionalmente SMTP de Supabase |
| `ANTHROPIC_API_KEY` | Consola de Anthropic | Server-only, usado por `engine/triage` y `engine/analyzer` — estos corren en GitHub Actions, no en Vercel, así que este secreto va en **GitHub Actions Secrets**, no en Vercel |
| `INTERNAL_GENERATOR_TOKEN` | Generado a mano (`openssl rand -hex 32`) | Compartido entre Vercel y el microservicio de D0.1, para que el endpoint de PDF no sea invocable desde fuera |

**Regla dura:** ninguna de las variables `server-only` lleva el prefijo `NEXT_PUBLIC_`. Antes de cerrar D3, grep rápido sobre el código para confirmar que `SUPABASE_SERVICE_ROLE_KEY` y `TURNSTILE_SECRET_KEY` nunca se leen desde un componente cliente (`'use client'`).

---

## D4 — GitHub Actions en producción

`.github/workflows/radar.yml` ya existe pero apunta a variables `POSTGRES_*` sueltas. Con Supabase Cloud, simplificar a una única `SUPABASE_DB_URL` (connection string directa, no el pooler — el cron corre una vez al día, no necesita pooler) como *Repository secret*.

Añadir, tal como quedó pendiente en el propio `radar.yml` (P2.2 de la auditoría anterior):
```yaml
      - name: Triaje con IA
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: python engine/triage/runner.py

      - name: Análisis profundo
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: python engine/analyzer/analyzer.py
```
Vigilar que el total siga bajo el límite de 45 minutos ya fijado en el workflow; si al añadir estos dos pasos se acerca al límite, separarlos en un segundo workflow con su propio cron (p. ej. triaje/análisis a las 07:00, después de que el scraping de las 06:00 haya terminado).

*Hecho cuando:* el workflow corre en producción de punta a punta —scraping → prefiltro → triaje → análisis → export— sin intervención manual, durante 3 días seguidos.

---

## D5 — Terceros

### D5.1 — Resend
- Verificar el dominio propio en Resend (registro DNS TXT/DKIM) para que los correos de alertas no lleguen marcados como sospechosos. Sin dominio verificado, Resend obliga a enviar desde su dominio compartido, lo cual está bien para arrancar pero conviene resolverlo cuando el dominio del proyecto esté decidido (D2.1).
- Confirmar el límite gratuito (3.000 emails/mes, 100/día) es compatible con el volumen esperado de alertas + confirmaciones de enlace mágico.

### D5.2 — Cloudflare
- Activar Cloudflare Web Analytics apuntando al dominio de producción (script en el `<head>`, sin cookies — confirmar que sigue sin banner de consentimiento).
- Turnstile: crear un **widget de producción** distinto del de pruebas, con el dominio real en la whitelist. El *site key* de pruebas usado hasta ahora acepta cualquier dominio y no debe llegar a producción.

### D5.3 — Monitorización mínima
- Activar Vercel Analytics (gratis, básico) o dejarlo fuera si Cloudflare Analytics ya cubre lo necesario — no duplicar.
- Alertas de Supabase: activar en el dashboard el aviso por email si el uso se acerca al límite del plan gratuito (BD, storage, auth).
- Confirmar que los correos de fallo del cron de GitHub Actions llegan a una dirección que se revisa (por defecto van al dueño del repo).

---

## D6 — Checklist de salida a producción (go-live)

Ejecutar en este orden, cada uno bloqueando al siguiente:

1. [ ] D0.1 y D0.2 cerrados y probados en local/staging.
2. [ ] Proyecto Supabase Cloud creado, migraciones aplicadas, RLS verificada con las mismas pruebas de la reauditoría (`GET /rest/v1/incidencias` con anon key → `[]`; `PATCH` directo a `suscripciones_alertas` → 0 filas afectadas) pero contra el proyecto **de producción**, no el local.
3. [ ] Microservicio Python desplegado y accesible solo con el token interno.
4. [ ] Proyecto Vercel desplegado sobre `*.vercel.app`, todas las variables de entorno de D3 cargadas.
5. [ ] Smoke test manual completo en el dominio `*.vercel.app` antes de mover DNS:
   - [ ] Registrarse con enlace mágico, sesión persiste tras 10 min de inactividad.
   - [ ] Reportar una incidencia real de prueba: formulario → Turnstile → foto sin EXIF → aparece en `/admin` pendiente de moderar.
   - [ ] Aprobar desde `/admin`, confirmar que aparece en `/mapa` con coordenada visiblemente distinta a la real.
   - [ ] Generar un PDF de alegación desde una norma de prueba — confirma que D0.1 funciona en el entorno real, no solo en local.
   - [ ] Suscribirse a alertas de una provincia y darse de baja con el enlace del correo.
   - [ ] `GET /api/v1/incidencias` devuelve JSON válido con `geom_publica`, nunca `geom`.
6. [ ] Dominio propio apuntado (si ya está decidido) y HTTPS confirmado.
7. [ ] Cron de GitHub Actions corriendo contra Supabase Cloud, verificado 2-3 días antes del lanzamiento con difusión.
8. [ ] Página `/cobertura` refleja el estado real de fuentes (todas inactivas todavía, y eso es honesto — no maquillarlo).
9. [ ] Los cuatro documentos legales (`/aviso-legal`, `/privacidad`, `/terminos`, `/moderacion`) revisados una última vez con el dominio y los datos de contacto ya definitivos.
10. [ ] Borrar cualquier incidencia/caso de prueba insertado durante el smoke test antes de anunciar el sitio.

---

## D7 — Qué hacer si algo se rompe después del lanzamiento

- **Rollback de código:** Vercel mantiene todos los despliegues anteriores — "Promote to Production" sobre el último despliegue bueno revierte en segundos, sin tocar git.
- **Rollback de esquema:** las migraciones de Supabase son aditivas por diseño en este proyecto; si una migración nueva rompe algo, escribir una migración de reversión explícita (`0011_revert_x.sql`), nunca editar una migración ya aplicada en producción.
- **El microservicio Python se cae:** los endpoints de generación de PDF deben fallar con un mensaje claro ("inténtalo de nuevo en unos minutos"), nunca con un 500 críptico — añadir ese manejo de error al hacer el `fetch()` en D0.1.
- **Turnstile empieza a bloquear usuarios legítimos:** el *widget* de Cloudflare tiene modo "Managed" (recomendado) vs "Invisible" — si hay quejas, bajar de invisible a managed antes que desactivarlo.

---

## Orden de ejecución y estimación

| Bloque | Días de trabajo (una persona) | Depende de |
|---|---|---|
| D0.1 + D0.2 | 1,5 | — |
| D1 (Supabase Cloud) | 0,5 | — |
| D2 (Vercel + dominio) | 0,5 | Nombre elegido (D2.1) para el dominio final; el resto no depende |
| D3 (variables de entorno) | 0,5 | D1, D2 |
| D4 (Actions en producción) | 0,5 | D1 |
| D5 (Resend, Cloudflare, monitor) | 0,5 | D1, D2 |
| D6 (checklist y smoke test) | 0,5 | Todo lo anterior |

Total: **~4 días de trabajo efectivo**, no de calendario. Puede comprimirse si D2.1 (el nombre) ya está decidido antes de empezar.
