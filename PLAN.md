# Plan de fases y sprints — Plataforma de defensa del caravaning (ES)

> Documento de especificación para el equipo de desarrollo (Antigravity).
> Directorio de trabajo: `C:\ACenlucha`. Estado actual: vacío (solo `runbook.html`, documento de contexto).

---

## Context

**Problema.** En España existe un conflicto creciente y mal documentado entre usuarios de autocaravanas y ordenanzas municipales que restringen el estacionamiento por tipología de vehículo (altura, longitud, MMA, «autocaravanas y similares»), a menudo confundiendo *estacionar* con *acampar*. El daño real no es solo la restricción: es la **opacidad** (las ordenanzas se aprueban y modifican sin que los afectados se enteren dentro del plazo de alegaciones) y la **falta de continuidad** (las movilizaciones se agotan en grupos de Facebook, sin seguimiento ni memoria de qué funcionó).

**Qué se construye.** No una app de caravaning ni un mapa de áreas. Una infraestructura abierta que ejecuta un ciclo: *detectar → documentar → analizar → habilitar acción administrativa → seguir → aprender*. El producto es el ciclo, no la web.

**Restricciones que condicionan todo el diseño.**

| Restricción | Consecuencia |
|---|---|
| Una sola persona + IA, sin equipo ni intención de contratar | Todo gestionado. Ninguna tarea recurrente que no quepa en 20 min/día. |
| Proyecto personal, responsable identificado | Responsable del tratamiento a título personal desde el primer día público. |
| Presupuesto de bolsillo | Objetivo < 30 €/mes. El único coste elástico es la IA: se contiene con prefiltro. |
| Cobertura nacional, sin pilotos | Recepción nacional inmediata; automatización de boletines progresiva y con estado público. |
| Cero datos de partida | Corpus semilla cargado a mano antes de pedir aportaciones. |
| Métrica de éxito: 50 aportaciones de terceros en 90 días | La puerta de entrada se prioriza sobre cualquier otra función. |

**Resultado esperado del plan.** Repositorio funcional en local en ~1 semana, sitio público recibiendo reportes en ~2,5 semanas, radar normativo operativo en ~5 semanas, generación de escritos en ~7 semanas. Punto de decisión objetivo a los 90 días del lanzamiento con difusión.

---

## Arquitectura: cuatro capas y tres autoridades

Se adopta el modelo de 4 capas (mejora sobre las 3 del runbook original):

1. **Red pública** — cualquiera consulta, reporta, aporta, corrige, descarga datos y código, y construye herramientas encima. Es lo que genera legitimidad.
2. **Sistema abierto** — scrapers, parser, pipeline IA, API, frontend, esquema. Código público bajo **AGPL-3.0** (obliga a que las mejoras distribuidas vuelvan).
3. **Núcleo de confianza** — no controla «el proyecto»: controla **qué información adquiere autoridad dentro del proyecto**.
4. **Motor de acción** — convierte un hallazgo en vías de actuación concretas con plazos, pero **la acción la ejecuta y firma el ciudadano**.

### La separación que hace defendible el control

Esta es la corrección de fondo respecto al runbook anterior, que agrupaba las tres cosas bajo una sola autoridad. Separarlas **aumenta** el control efectivo, porque concentra el poder donde importa y lo hace argumentable:

| Autoridad | Quién decide | Evoluciona hacia |
|---|---|---|
| **Verificación factual** (niveles 1–3) | Núcleo en v1 | Validadores comunitarios acreditados |
| **Valoración jurídica** (nivel 5) | Abogados identificados | Panel jurídico externo |
| **Prioridad estratégica** (qué se eleva a campaña) | **Núcleo, y solo el núcleo** | No se delega nunca |

Regla explícita: el núcleo **no puede** disparar acciones en nombre de nadie. Puede decir «hay expediente abierto, 327 afectados, 84 alegaciones presentadas, el plazo vence el día X». Cada ciudadano decide si presenta la suya. Esto es lo que hace el sistema resistente a la captura y lo que lo separa de una asociación.

Los criterios de las tres autoridades se publican en una página **«Cómo se decide aquí»**. El foso defensivo no es la opacidad: es el histórico verificado, la red de validadores y la memoria de qué argumentos funcionaron. Un fork copia el código en diez minutos y no copia nada de eso.

---

## Decisiones técnicas transversales

**Monorepo desacoplado en `C:\ACenlucha`:**

```
ACenlucha/
├── engine/                    # Python 3.12
│   ├── scrapers/adapters/     # un adaptador por TIPO de fuente, no por provincia
│   ├── prefilter/             # regex de dos niveles
│   ├── triage/                # Haiku
│   ├── analyzer/              # Sonnet
│   ├── corpus/                # normativa de referencia verificada a mano
│   └── tests/
├── web/                       # Next.js (App Router)
│   └── src/app/
│       ├── (public)/          # portada, reporte, mapa, municipio, norma, cobertura
│       └── admin/             # cola de moderación mobile-first
├── supabase/migrations/       # DDL reproducible y versionado
├── docs/                      # criterios, protocolo de IDs, legales
└── PLAN.md                    # este documento
```

**Stack** — Next.js + Vercel · Supabase Postgres/PostGIS (región Frankfurt) · GitHub Actions para cron · API de Claude (Haiku 4.5 triaje / Sonnet 5 análisis) · Resend · Cloudflare Web Analytics (sin cookies ⇒ **sin banner**) · MapLibre + OSM · Cloudflare Turnstile.

**Local primero.** Fase 0 y 1 se desarrollan íntegramente contra `supabase start` en Docker. No se toca Vercel, DNS, Resend ni la API de pago hasta el sprint 1.3. Esto elimina el principal riesgo de abandono temprano.

**Identificadores de protocolo desde el primer DDL.** Formato `ES-MU-{INE}-{TIPO}-{año}-{secuencial}`, p. ej. `ES-MU-13028-NOR-2026-003`. Tipos: `NOR` norma, `INC` incidencia, `EVI` evidencia, `CAS` caso, `ACC` acción, `RES` resultado. Se generan con secuencia por (municipio, tipo, año). **Es la decisión menos negociable del plan**: retrofitear IDs jerárquicos con histórico poblado y CSV ya publicados rompe todas las referencias externas.

**Prefiltro de dos niveles** (corrección al propuesto: eliminar duplicados, `[es]` malformado, y no usar `estacionamiento` como término de primer nivel — haría candidato medio boletín):

- **Nivel A, específico → candidato inmediato:** `autocaravana`, `caravana`, `camper`, `vehículo vivienda` / `vehículo-vivienda`, `casa móvil`, `remolque vivienda`, `pernocta`, `vivac`, `gálibo`, `limitador de altura`, `área de autocaravanas`, `autocaravanas y similares`. Variantes: ca/val `pernoctació`, `gàlib`, `acampada`; gl `pernoita`, `estacionamento`; eu `ibilgailu etxebizitza`, `kanpatze`.
- **Nivel B, genérico → candidato solo con co-ocurrencia o si el anuncio es aprobación/información pública de ordenanza:** `acampada`, `estacionamiento`, `ordenanza de circulación|convivencia|movilidad`, `MMA`, `3.500 kg`.
- Normalización previa: NFKD + eliminación de diacríticos, para que el texto salido de OCR con acentos degradados siga casando. Comparar sobre el texto normalizado, conservar el original para la cita literal.

---

## Fase 0 — Cimientos locales (~5 días)

Objetivo: repositorio que arranca en una máquina limpia, con el esquema definitivo y las semillas cargadas. Cero servicios externos.

### Sprint 0.1 — Monorepo y DDL maestro (2 días)
- `git init`, estructura de carpetas, `.gitignore`, licencia AGPL-3.0, `README` con instrucciones de arranque local.
- `docker-compose` / `supabase init` + `supabase start`.
- **Migración `0001_schema.sql`** con las 11 tablas completas: `municipios`, `fuentes`, `publicaciones`, `normas`, `hallazgos`, `incidencias`, `evidencias`, `casos`, `acciones`, `resultados`, `estrategias`. Extensiones `postgis`, `pgcrypto`, `pg_trgm`. Función y secuencias de generación de `protocol_id`. Índices GiST sobre `municipios.geom` e `incidencias.geom_publica`. `hash_sha256 unique` en `publicaciones` como anti-duplicado. Columna generada `duracion_dias` en `resultados`.
- Row Level Security desde el inicio: lectura pública solo de filas con `estado_moderacion='aprobado'`; escritura solo del propio usuario; `service_role` para el engine.
- **`estrategias` y `resultados` se crean vacías y no se usan hasta la Fase 3.** Es deliberado: el motor de estrategia administrativa no se programa ahora, pero los datos que necesitará tienen que existir desde el primer caso o se pierden dos años de expedientes.
- *Hecho cuando:* `supabase db reset` reconstruye todo desde cero sin errores y un test verifica que un insert genera un `protocol_id` bien formado.

### Sprint 0.2 — Semillas (1 día)
- Carga de los 8.131 municipios con código INE, provincia, comunidad, población y centroide (dataset público del INE / IGN).
- Catálogo de las 52 fuentes provinciales clasificadas por `tipo` (`rss` / `json` / `pdf_fijo` / `html`) y `activo=false` hasta que su adaptador exista. Esta tabla es la que alimenta la página pública de cobertura.
- *Hecho cuando:* consulta por nombre de municipio con autocompletado responde en < 50 ms en local.

### Sprint 0.3 — Identidad y marco legal (2 días)
- **Decisión bloqueante: nombre y dominios.** Recomendación: dominio principal institucional (para datos, prensa y trato con administraciones) + dominio militante que redirige (para campañas y grupos). 12 €/año cada uno. Sin esto no se puede cerrar el sprint 1.3.
- Cuatro documentos en `docs/`: aviso legal, política de privacidad, términos de uso, política de moderación.
- **Página «Cómo se decide aquí»** con las tres autoridades de la tabla anterior y sus criterios.
- Reserva de nombres en X, Instagram y Telegram.
- *Hecho cuando:* los cuatro documentos están escritos y revisados, y el dominio está comprado.

---

## Fase 1 — La puerta abierta (~7 días) → primer despliegue público

Objetivo: cualquiera puede reportar desde cualquier municipio de España, y el responsable puede moderar desde el móvil. Esta fase existe **antes** del radar porque la métrica de éxito son 50 aportaciones de terceros, y un radar sin puerta de entrada no las genera.

### Sprint 1.1 — Captación (3 días)
- Auth por **enlace mágico** (sin contraseñas que custodiar) + **Turnstile** en el formulario. Ambas cosas desde el día uno: un formulario abierto sin verificación recibe spam masivo en horas.
- Formulario de incidencia: municipio con autocompletado, tipo (`senal_ilegal` / `multa` / `desalojo` / `bloqueo_acceso`), foto, coordenadas, descripción. **Cuatro campos y una foto, ni uno más.** Mobile-first y tolerante a mala cobertura (borrador en `localStorage`, reintento de subida).
- Pipeline de imagen: **eliminación de EXIF en cliente antes de subir** (canvas re-encode), SHA-256 calculado y guardado, `geom` exacta privada y `geom_publica` ofuscada a ~100 m.
- Checkbox obligatorio de certificación: *«Declaro no incluir rostros de particulares ni matrículas legibles ajenas.»*
- *Hecho cuando:* se reporta una incidencia real desde un móvil y en la BD aparece con EXIF limpio, hash correcto y coordenada pública desplazada.

### Sprint 1.2 — Moderación (2 días)
- Panel `/admin` mobile-first: cola de pendientes, foto a tamaño completo, botones aprobar / requiere retoque / rechazar con motivo. Objetivo de tiempo: 5 segundos por elemento.
- Herramienta de difuminado sobre la propia foto para matrículas o caras que se hayan colado.
- Registro inmutable de moderación (quién, cuándo, qué decisión).
- *Hecho cuando:* 20 elementos de prueba se procesan en menos de 3 minutos desde el móvil.

### Sprint 1.3 — Publicación (2 días)
- Ficha pública por municipio; mapa nacional de incidencias con MapLibre. **Solo incidencias: ni una sola área de pernocta recomendada** — es la trampa que convierte esto en otro Park4Night y diluye el foco entero.
- Portada que explica qué es esto en dos frases + páginas legales enlazadas.
- Migración a Supabase Cloud (Frankfurt), despliegue en Vercel, DNS, Resend, Cloudflare Analytics.
- **Export diario a Git**: volcado de los datos públicos a CSV y JSON en el repositorio. Esto da auditabilidad, copia de seguridad y resistencia a caída del servidor, gratis y sin IPFS.
- *Hecho cuando:* el dominio sirve el sitio, un desconocido puede reportar, y el export corre solo.

> **Hito: soft-launch.** Público y funcional, sin difusión todavía. La difusión espera a tener contenido (Fase 2) para que quien llegue vea algo y entienda qué aportar.

---

## Fase 2 — Radar y análisis (~14 días) → lanzamiento con difusión

### Sprint 2.1 — Corpus normativo verificado a mano (3 días)
El sprint que se salta todo el mundo y del que depende toda la credibilidad del proyecto.
- Construir `engine/corpus/` con la normativa de referencia: Reglamento General de Circulación, la instrucción vigente de la DGT sobre estacionamiento y acampada de autocaravanas, doctrina sobre competencias municipales en materia de circulación, y las sentencias relevantes.
- **Cada entrada del corpus lleva URL oficial, fecha de consulta y hash del documento.** Ninguna referencia normativa entra en el corpus por haberla dicho una IA (ni yo): se verifica una a una contra la fuente oficial. Una cita inventada en una alegación destruye la credibilidad del proyecto de forma irreversible, y las referencias concretas que circulan en los documentos de brainstorming previos (números de instrucción incluidos) **no están verificadas**.
- Carga a mano de 25–30 casos reales ya conocidos, como corpus semilla de contenido.
- *Hecho cuando:* cada norma de referencia es trazable a su publicación oficial y hay 30 casos visibles en el sitio.

### Sprint 2.2 — Scrapers y prefiltro (4 días)
- Cuatro adaptadores, uno por `tipo` de fuente, no uno por provincia.
- Activación de 15–20 fuentes priorizando litoral e insular, donde está el conflicto real: Pontevedra, A Coruña, Cantabria, Asturias, Girona, Tarragona, Alicante, Málaga, Cádiz, Baleares.
- Prefiltro de dos niveles con normalización de diacríticos (ver decisiones transversales). Batería de tests con anuncios reales positivos y negativos.
- **Aislamiento del OCR:** el job diario de scraping nunca hace OCR. Los PDF sin capa de texto se encolan en `publicaciones` con marca `necesita_ocr` y los procesa un job separado, con tope de páginas y de peso. Sin esta separación se agotan los 6 h de límite de GitHub Actions y el radar se cae en silencio.
- Cron diario en GitHub Actions con alerta por correo si un adaptador falla dos días seguidos.
- Página pública de cobertura por provincia, alimentada de `fuentes`. Es honesto y convierte cada hueco en una petición de ayuda concreta.
- *Hecho cuando:* el radar corre 7 días sin intervención y el prefiltro deja ~8 candidatos/día de ~400 anuncios.

### Sprint 2.3 — Triaje (2 días)
- Haiku sobre lo que sobrevive al prefiltro: ¿afecta al caravaning? ¿es aprobación inicial, información pública, aprobación definitiva o derogación? Salida estructurada con nivel de confianza.
- Bandeja de revisión en `/admin` para ascender a `normas` o descartar.
- Presupuesto: ~10 €/mes. El prefiltro es toda la economía del sistema; sin él esto cuesta cientos.
- *Hecho cuando:* el triaje detecta al menos un anuncio relevante real y el coste diario medido está bajo control.

### Sprint 2.4 — Analizador y alertas (5 días)
- Extracción de texto (con OCR de reserva ya aislado) y análisis con Sonnet contra el corpus del sprint 2.1: artículo, **cita literal**, `tipo_restriccion`, fundamento del problema, confianza.
- Ficha pública de norma con los hallazgos, **siempre con la cita literal a la vista** y marcada como análisis automático hasta verificación humana.
- Detección de `plazo_alegaciones_hasta` y cuenta atrás visible.
- Alertas por correo: seguir una provincia o un municipio.
- *Hecho cuando:* tres ordenanzas reales analizadas y los hallazgos resisten la lectura humana del documento original.

> **Hito: lanzamiento con difusión.** Grupos de Facebook uno a uno con mensaje adaptado (canal principal — no quemarlo con spam), foros, Telegram, X. Texto de presentación personal, con nombre y cara: aquí la credibilidad es personal. Contacto informativo con ASEICAR y asociaciones territoriales ofreciendo los datos, sin pedir nada ni proponer fusión. Correo a dos o tres periodistas que ya hayan escrito del tema, con datos concretos y no con nota de prensa.
>
> **Empieza el reloj de 90 días.**

---

## Fase 3 — Motor de acción (~10 días)

De documentar a actuar. Tres plantillas, las que cubren el 80 % de los casos.

### Sprint 3.1 — Generación documental (4 días)
- Plantillas: **alegación** a ordenanza en información pública; **solicitud de acceso a información pública** sobre una señal (acuerdo que la aprueba + expediente); **escrito de disconformidad** por señalización no homologada o contraria a la ordenanza vigente.
- Generación parametrizada a partir del `hallazgo`: el sistema rellena municipio, artículos, citas y argumentos, y entrega PDF.
- Descargo en cada documento: *no constituye asesoramiento jurídico; el usuario presenta bajo su responsabilidad*.
- **El sistema prepara. El usuario firma y presenta con su identidad. El sistema registra hash y sello de tiempo del envío.** No se custodian certificados digitales en ningún caso.
- *Hecho cuando:* un escrito generado es revisado por un abogado y se considera presentable sin retoques.

### Sprint 3.2 — Panel de batalla (3 días)
- «Mis acciones»: registro de lo presentado con fecha, plazo y estado. Recordatorio por correo al acercarse el vencimiento.
- Contadores públicos por caso: afectados que reportan, alegaciones registradas, días hasta el plazo. Nunca una acción disparada por el sistema.
- *Hecho cuando:* un usuario genera, presenta y registra una alegación de principio a fin.

### Sprint 3.3 — Memoria operacional (3 días)
- Formulario de cierre de caso que alimenta `resultados`: qué se hizo, qué argumentos, qué respondió la administración, cuánto tardó, y si se estimó, se desestimó o hubo silencio.
- `estrategias` como vista agregada: estrategia × tipo de caso × tasa de éxito. Con 20 casos ya empieza a decir algo; con 500 es un activo que nadie más tiene.
- *Hecho cuando:* cerrar un caso tarda menos de 60 segundos y la vista de estrategias devuelve datos reales.

---

## Fase 4 — Patrones e inteligencia (solo si se supera el punto de decisión)

Esta es la mejor idea de todo el brainstorming y por eso va aquí y no antes: necesita corpus. Sin 200+ ordenanzas cargadas no detecta nada.

### Sprint 4.1 — Detección de patrones nacionales (5 días)
- Similitud entre ordenanzas con `pg_trgm` para coincidencia literal + embeddings para similitud semántica.
- Salida: *«estas 83 ordenanzas proceden aparentemente de la misma plantilla»* / *«147 municipios tienen el artículo 14 con redacción casi idéntica»*.
- **Casos semilla:** marcar un caso como semilla dispara la búsqueda automática del mismo patrón en el resto del país. Convierte una batalla local en un problema nacional demostrable con datos, que es el salto de escala del proyecto.
- Embudo público de agregación: incidencias → municipios → patrones normativos → problemas jurídicos → conflictos estratégicos → campañas.

### Sprint 4.2 — Scoring estratégico (3 días)
- Puntuación de `potencial_estrategico`: ¿hay jurisprudencia favorable cercana? ¿acaba de abrirse información pública? ¿cuántos afectados? ¿alcance del patrón? ¿potencial mediático?
- El scoring **sugiere**; la selección de campaña la decide el núcleo, con el motivo publicado.

### Sprint 4.3 — Métricas públicas e informe (3 días)
- Porcentaje de alegaciones que logran modificación o retirada, tiempo medio de respuesta municipal, argumentos más eficaces por tipo de restricción y perfil de municipio.
- Informe anual: es el paso de «herramienta» a «infraestructura de referencia», y lo que atrae abogados, periodistas y políticos.

---

## Fase 5 — Protocolo y federación (condicional)

Solo si hay tracción real y demanda externa. Se **diseña para** desde el sprint 0.1 (IDs jerárquicos, hashes) pero no se construye antes de que haga falta.

- **V2** API pública documentada y datos replicados en varios mirrors.
- **V3** validadores independientes con credenciales propias.
- **V4** firmas criptográficas de validación (sin sentido con un solo validador; a partir de cinco, sí).
- **V5** federación / ActivityPub, cuando exista comunidad que federar.

El «Caravaning Rights Protocol» en v1 **no es un documento de especificación**: es el esquema de IDs, un export JSON documentado y una API de lectura. Escribir una especificación formal de protocolo que nadie consume todavía es trabajo desperdiciado.

---

## Lo que NO se construye, y por qué

| Descartado | Motivo |
|---|---|
| Mapa de áreas / dónde dormir | Convierte esto en el enésimo clon de Park4Night y diluye todo el foco. **Nunca.** |
| IPFS y almacenamiento distribuido | El export diario a Git da auditoría y resistencia hoy. IPFS cuando alguien intente tirarte, no antes. |
| Firmas criptográficas | Con un solo validador no aportan nada. |
| Motor de estrategia programado | Necesita 100+ casos cerrados (~2 años). Mientras tanto se registran resultados, que es lo irrecuperable. |
| Financiación de litigios | Requiere estructura jurídica, cuentas y transparencia formal. Solo con asociación constituida. |
| App móvil nativa | Una web bien hecha en móvil cubre esto. |
| Blockchain | No resuelve ningún problema que este proyecto tenga. |
| Asociación o fundación | Cuando llegue el primer litigio serio o el primer dinero de terceros. Ni un día antes. |

---

## Registro de riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Requerimiento municipal de retirada de una ficha | Alta | Todo lo publicado en nivel ≥3 cita el documento oficial. Se contesta con la cita. |
| Foto con matrícula o cara publicada | Alta | Moderación previa, EXIF eliminado en cliente, certificación del usuario, retirada en 24 h. |
| Acusación de asesoramiento jurídico | Media | Descargo en cada documento. El sistema prepara; el usuario firma y presenta. |
| Reclamación por honor de un cargo público | Media | Raya explícita: institución sí, persona no. Sin excepciones aunque el caso dé la razón moral. |
| Cita normativa inventada en un escrito | Media | Corpus verificado documento a documento contra fuente oficial, con URL, fecha y hash. Sprint 2.1. |
| OCR agota el límite de GitHub Actions | Media | OCR en job separado y encolado, con tope de páginas y peso. Sprint 2.2. |
| Spam masivo en el formulario | Alta si no se mitiga | Enlace mágico + Turnstile desde el primer día público. |
| Coste de IA descontrolado | Media | Prefiltro de dos niveles antes de cualquier llamada. Alerta de gasto diario. |
| Deber de retirada (no trasladable al usuario) | Cierto | Los términos de uso trasladan la responsabilidad de la *acción*, no el deber de retirada del *contenido*. Ese lo asume el responsable, y por eso la política de moderación es un documento operativo, no decorativo. |

RGPD, versión mínima y suficiente: correo como único dato obligatorio, sin cookies de terceros, alojamiento en la UE, política de privacidad con responsable identificado, borrado de cuenta en un clic.

---

## Verificación

**Por sprint.** Cada sprint tiene su criterio *Hecho cuando* arriba. Ninguno se cierra sin cumplirlo.

**End-to-end, al cerrar cada fase:**

1. **Fase 0** — `supabase db reset` en máquina limpia reconstruye esquema y semillas sin errores. Test de generación de `protocol_id`. Consulta de autocompletado de municipio < 50 ms.
2. **Fase 1** — Reporte real desde un móvil: verificar en BD que el EXIF está limpio (`exiftool` sobre el fichero almacenado), que el hash coincide, que `geom_publica` difiere de `geom`, y que la fila es invisible en la API pública hasta aprobarla. Moderar 20 elementos de prueba en < 3 min.
3. **Fase 2** — Radar corriendo 7 días consecutivos sin intervención; volumen medido de candidatos/día; batería de tests del prefiltro sobre anuncios reales etiquetados a mano; tres ordenanzas analizadas cuyos hallazgos resisten la lectura humana del PDF original.
4. **Fase 3** — Un escrito generado revisado por un abogado y considerado presentable. Un caso completo: hallazgo → escrito → presentación → registro → cierre con resultado.
5. **Fase 4** — Detección de patrón validada a mano: tomar tres municipios que se sabe que comparten plantilla y comprobar que el sistema los agrupa.

**Punto de decisión — 90 días desde el lanzamiento con difusión.** Umbral: 50 aportaciones de personas distintas del responsable.

- **> 50** — el problema es real y la gente responde. Reforzar Fase 3, buscar abogado colaborador, plantear estructura jurídica, abrir Fase 4.
- **20–50** — el producto funciona, la distribución no. Tres meses centrados solo en llegar a la gente, sin tocar código.
- **< 20** — la hipótesis falla: hay cabreo pero no disposición a actuar. Se congela, el sitio queda en pie como archivo público, no se le echan más horas. Es un resultado, no un fracaso.

La medida honesta: 50 aportaciones es un listón bajo a propósito. Lo difícil no es esa cifra — es que la primera alegación generada por la plataforma se presente de verdad en el registro de un ayuntamiento. Ese es el momento en que esto deja de ser una web y pasa a ser una herramienta.

---

## Decisión bloqueante pendiente

**Nombre y dominios** (sprint 0.3). Condiciona dominio, correo, logo, cuentas de redes y el primer commit. Recomendación: marca neutra e institucional en el dominio principal y en la capa de datos, tono directo y sin eufemismos en el contenido; segundo dominio militante que redirige, para campañas. Un nombre mediocre publicado le gana a uno perfecto que no llega nunca.
