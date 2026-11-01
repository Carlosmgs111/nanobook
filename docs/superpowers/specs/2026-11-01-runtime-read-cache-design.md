# Caché de lectura SSR con Vercel Runtime Cache

## Problema

Las lecturas SSR de un documento realizan consultas LibSQL/Turso seriales: una
para resolver el nanobook por `slug` y otra para el documento por
`nanobookId + ruta`. Cada una tarda aproximadamente 115 ms. Navegación,
sesión, Redis de páginas publicadas y Shiki no son los cuellos de botella.

## Decisión

Añadir cachés de lectura de datos, no de respuestas HTML, usando Vercel Runtime
Cache en producción y adaptadores en memoria durante desarrollo y pruebas.

- Nanobook: `nanobook:v1:slug:{slug-normalizado}` guarda un snapshot completo
  y reconstruible de `Nanobook`.
- Documento fuente: `document:v1:{nanobookId}:{version}:{ruta-normalizada}`
  guarda un snapshot reconstruible de `Document`. La `version` es compartida
  por nanobook y cambia después de cualquier evento documental confirmado.
- La resolución de proxies se ejecuta siempre después de recuperar el documento
  fuente; nunca se guarda el documento ya resuelto.

## Coherencia e invalidación

- Crear, editar o eliminar un nanobook actualiza o borra la entrada por slug;
  una edición de slug borra primero el slug anterior. Los cambios de tema se
  consideran una edición del nanobook y reemplazan su snapshot.
- `DocumentCreated`, `DocumentUpdated` y `DocumentDeleted` cambian la versión
  compartida del nanobook. No requieren rutas antiguas o nuevas en sus
  contratos.
- La invalidación se suscribe al mismo bus de eventos en el que ya se actualiza
  navegación y se invalida el HTML publicado.
- Sesiones, decisiones de autorización y HTML completo de páginas quedan fuera
  de estas cachés.

## Observabilidad y límites

- Mantener `Server-Timing` por tramo y añadir en middleware `app-total`, que
  mide de `next()` a la respuesta para distinguir aplicación de plataforma/red.
- Usar TTL de 300 segundos como límite de recuperación y claves con versión
  `v1`, aunque las mutaciones son la vía normal de invalidación.
- No intentar guardar snapshots documentales de 2 MB o más, límite publicado de
  Vercel Runtime Cache; en ese caso se devuelve la lectura de origen.
- Una invalidez o fallo del snapshot se trata como *miss* y vuelve al origen.
  Los errores al invalidar después de una mutación siguen el contrato actual
  del bus: hacen fallar la publicación del evento y quedan visibles para
  operación, en vez de ocultar una posible entrada obsoleta.

## Fuera de alcance

- Cachear sesiones, respuestas HTML privadas, autorización o resultados de
  proxies.
- Cambiar los contratos de eventos documentales para incluir rutas.
- Alterar Redis de páginas publicadas o la caché de grafos de navegación.
