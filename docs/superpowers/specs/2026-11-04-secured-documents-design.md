---
title: "Diseño: documentos protegidos con desafío de contraseña"
date: 2026-11-04
status: proposed
---

# Diseño: documentos protegidos con desafío de contraseña

## Intención

Permitir que el propietario de un nanobook marque un documento como protegido. Quien intente leerlo —desde el índice, el sidebar o cargando la URL directamente— debe resolver primero un desafío de contraseña; solo entonces se renderiza el documento.

Esta primera entrega implementa un único método de acceso (contraseña) detrás de una interfaz de políticas, de modo que perfiles y niveles de autorización puedan sumarse después sin rehacer rutas, formulario ni cookies.

## Decisiones acordadas

| Tema | Decisión |
|---|---|
| Propietario | Quien puede escribir en el nanobook (`AuthorizeNanobook.canWrite`) **no** pasa el desafío. |
| Visibilidad previa | En índice y sidebar, un lector sin acceso ve **título y candado**. Se ocultan descripción, etiquetas y encabezados. |
| Herencia | Ninguna. El atributo aplica solo al documento que lo declara, incluso si es un índice. |
| Mecanismo | Guard en la ruta del documento y cookie firmada por documento. |
| Durabilidad inicial | Concesión absoluta de 12 h, definida en una única política reemplazable. |

## Objetivos

- Un documento protegido nunca se renderiza, publica ni cachea como HTML para quien no tiene acceso.
- La URL del documento es la misma antes y después del desafío.
- La contraseña nunca se almacena en claro ni aparece en frontmatter, API, MCP, registros o cachés.
- Cambiar o quitar la contraseña revoca de inmediato todas las concesiones emitidas.
- El flujo es utilizable sin sesión (lectores anónimos).

## No objetivos

- Herencia por subárbol, precedencia entre padre e hijo.
- Concesiones por usuario, perfiles y niveles de autorización.
- Renovación deslizante, «recordarme» o ventanas de gracia.
- Gestión de contraseñas por MCP (los agentes no la leen ni la cambian).
- CAPTCHA, recuperación de contraseña (el propietario fija una nueva) y notificaciones.

## Modelo de datos

### Atributo `secured`

`DocumentMetadata` incorpora `secured?: boolean` (ausente equivale a `false`), junto a `draft` y `ownerId`.

- Lo administra el servidor, igual que `ownerId`: `UpdateDocument` conserva el valor existente e ignora cualquier `secured` que llegue en el frontmatter editado. Solo los casos de uso de contraseña lo modifican.
- Se serializa solo en `metadata_json`; el frontmatter bruto no lo contiene (se regenera desde plantilla en cada guardado). Navegación, listados y el editor lo conocen por los metadatos.
- No forma parte del `contentHash` (que cubre solo el cuerpo): el guard actúa antes de publicar, así que no hace falta.

### Tabla `document_access`

| Columna | Tipo | Notas |
|---|---|---|
| `document_id` | texto, PK | FK a `document.id`, `ON DELETE CASCADE`. |
| `password_hash` | texto, **nullable** | scrypt con sal por registro, formato autodescriptivo (`scrypt$N$r$p$sal$hash`). Nulo tras quitar la protección: nadie puede desbloquear hasta fijar una nueva contraseña. |
| `password_version` | entero | Inicia en 1 y aumenta con cada cambio o retirada. |
| `updated_at` | marca de tiempo | |

Al retirar la protección se pone `password_hash = NULL`, se incrementa `password_version` y `secured = false`. La fila nunca se elimina (salvo con el documento): así la versión solo crece y las concesiones antiguas no reviven si se vuelve a proteger.

### Tabla `document_unlock_attempt`

Contador de intentos fallidos por `(document_id, client_key)` y ventana, usado para limitar fuerza bruta. `client_key` es un hash de la IP obtenida con la misma cabecera de confianza que el límite de Better Auth (`x-vercel-forwarded-for` en Vercel). Se guarda en SQL porque la memoria de una función serverless no es compartida.

### Falla cerrada

Si un documento tiene `secured = true` y no existe fila en `document_access` o su `password_hash` es nulo, solo quien puede escribir en el nanobook lo abre. Nadie más puede resolver el desafío.

### Migración

Una migración nueva (`0016`) crea ambas tablas. No modifica documentos existentes.

## Dominio y aplicación

Módulo `documents`, capas `domain/`, `application/` e `infraestructure/` (la grafía del módulo).

### Dominio

- `DocumentAccessPolicy`: puerto `evaluate({ document, viewer }): AccessDecision`.
  - `viewer`: `{ userId?: string, canWrite: boolean, grants: AccessGrant[] }`.
  - `AccessDecision`: `{ kind: "allow" }` o `{ kind: "challenge", method: "password" }`.
- `PasswordAccessPolicy`: única implementación inicial.
  1. Documento no protegido → `allow`.
  2. `viewer.canWrite` → `allow`.
  3. Existe una concesión vigente para el documento con la `password_version` actual → `allow`.
  4. En otro caso → `challenge`.
- Puertos: `DocumentAccessRepository` (leer, guardar, retirar la contraseña; incrementar versión), `PasswordHasher`, `AccessGrantCodec` (firmar y verificar), `UnlockAttemptLimiter`.
- La política de duración es un valor del dominio: `AccessGrantPolicy { ttlSeconds: 43200 }`.

### Aplicación (casos de uso)

| Caso de uso | Responsabilidad |
|---|---|
| `SetDocumentPassword` | Valida longitud (mínimo 8, máximo 128), calcula el hash, guarda `document_access`, incrementa la versión y marca `secured = true`. Requiere permiso de escritura. |
| `ClearDocumentPassword` | Incrementa la versión, elimina el registro y marca `secured = false`. Requiere permiso de escritura. |
| `AuthorizeDocumentAccess` | Evalúa la política para un documento y un espectador; usado por rutas y proyecciones. |
| `UnlockDocument` | Comprueba el límite de intentos, verifica la contraseña con comparación en tiempo constante y devuelve una concesión firmada o un error genérico. |

Todos devuelven `Result` conforme al contrato del proyecto; las excepciones quedan en adaptadores de E/S.

## Flujo de desafío

```text
GET /n/{slug}/{documento}
  ├─ ¿el espectador puede escribir en el nanobook?     → contenido
  ├─ ¿hay concesión vigente para este documento?        → contenido
  └─ si no                                              → 401 + formulario (misma URL)

POST /api/nanobooks/{nanobookId}/documents/unlock   { path, password }
  ├─ límite superado                                    → 429
  ├─ contraseña incorrecta                              → 403 (mensaje genérico)
  └─ correcta → Set-Cookie de concesión + { ok: true }  → el cliente recarga la URL
```

### Guard de ruta

El guard se evalúa en `DocumentPage` **después** de obtener el documento y **antes** de `pagePublisher.publish`. Si la decisión es `challenge`:

- Responde `401` con la página de desafío: título del documento, formulario de contraseña y enlace de regreso al índice. No incluye cuerpo, descripción ni encabezados.
- Cabeceras: `Cache-Control: no-store`, `X-Robots-Tag: noindex`.
- No se invoca `pagePublisher`; ningún HTML de contenido llega a la caché de páginas.
- En nanobooks públicos la ruta no lee la sesión; si algún eslabón de la cadena está protegido, la página la resuelve bajo demanda para saber si el espectador puede escribir (el propietario no debe ser desafiado).

### Endpoint de desbloqueo

Ruta pública (sin sesión) dentro del espacio de rutas del nanobook. Solo atiende nanobooks **públicos**; en uno privado responde `404`, para que no se pueda sondear contraseñas. La protección de origen del middleware sigue aplicando a `POST`. Respuestas:

| Caso | Respuesta |
|---|---|
| Documento o nanobook inexistente, o documento sin protección | `404` genérico |
| Contraseña incorrecta | `403` con el mismo mensaje en todos los casos |
| Límite de intentos superado | `429` con `Retry-After` |
| Correcta | `200 { ok: true }` y `Set-Cookie` |

No distingue entre «documento inexistente» y «documento sin protección» más allá del `404`, para no revelar estado.

### Cookie de concesión

- Nombre: `nbk-grant-{primeros 16 caracteres del hash SHA-256 del documentId}`.
- Valor: `base64url(payload).base64url(HMAC-SHA256)` con `payload = { d: documentId, v: passwordVersion, exp }`.
- Clave HMAC: derivada de `BETTER_AUTH_SECRET` mediante HKDF con una etiqueta fija de propósito; no se reutiliza el secreto en bruto.
- Atributos: `HttpOnly`, `SameSite=Lax`, `Path=/n` (el módulo de documentos no conoce el slug; el nombre de la cookie ya es único por documento), `Max-Age` igual al TTL, `Secure` en Vercel.
- Validación: firma, `exp`, `d` igual al documento y `v` igual a la versión actual de `document_access`.
- Una concesión inválida se ignora y se vuelve a desafiar; no genera error visible.

### Límite de intentos

5 fallos por `(documento, cliente)` en 15 minutos. Un acierto reinicia el contador. Los umbrales viven en la misma política que la duración.

## Superficies que podrían filtrar contenido

| Superficie | Tratamiento |
|---|---|
| `DocumentPage` | Guard descrito arriba. |
| Índice (`IndexList`) y sidebar (`SidebarNav`) | Para espectadores sin acceso, la proyección de cada entrada protegida conserva `title`, `path` y `secured`, y elimina `description`, `tags`, `headings`, `cover` y el cuerpo. Se muestra un candado. |
| Caché de grafos de navegación | **No se modifica.** Es compartida entre espectadores; la depuración ocurre al proyectar en la página, con una función pura `projectNavigationForViewer`. |
| Tabla de contenidos | Sin acceso no se genera: no hay encabezados que mostrar. |
| Documentos proxy (`ref`) | Un proxy resuelto toma la identidad y el atributo `secured` de su destino (comportamiento existente de `ProxyParser`). El guard evalúa la cadena [documento guardado, documento resuelto]: cada eslabón protegido exige su propia concesión. |
| Edición y vista previa | Ya requieren permiso de escritura. Sin cambios. |
| Agentes (MCP) | Actúan con la identidad del propietario, por lo que no pasan desafío. Las herramientas no exponen `password_hash`; `secured` sí es visible en la metadata. |
| Caché de fuentes de documentos | Almacena fuente en servidor; no se sirve sin pasar el guard. Sin cambios. |
| Registros | No se escribe la contraseña ni el hash. Los errores no incluyen el cuerpo de la petición. |

## Administración (interfaz)

- Panel «Protección» en la barra del editor, visible para quien puede escribir: establecer o cambiar contraseña, quitarla, y estado actual (protegido o no).
- Rutas de escritura, protegidas por las barreras existentes (`protect` + `withNanobookWriteAccess`):
  - `PUT /api/nanobooks/{nanobookId}/documents/access` con `{ path, password }`.
  - `DELETE /api/nanobooks/{nanobookId}/documents/access` con `{ path }`.
- Tras guardar, el cliente notifica por el bus de eventos existente (`DocumentUpdated`) para que se invaliden derivados; la versión de contraseña cambia el estado de acceso de inmediato.
- Las rutas exactas se alinearán con la convención vigente de identificación de documentos durante el plan de implementación.

## Interfaz del desafío

- Componente `DocumentUnlockPage.astro` en `documents/browser/ui/pages/`, con controlador de cliente que sigue el ciclo de `astro:page-load` / `astro:before-swap` del proyecto.
- Campo de contraseña con etiqueta, estados de carga y error accesibles (`aria-live`), sin revelar si el documento existe o si hay protección más allá de lo que la página ya muestra.
- Usa los tokens del tema del nanobook y el layout sin sidebar de documentos protegidos.

## Errores y casos límite

| Situación | Comportamiento |
|---|---|
| Contraseña vacía o fuera de rango al establecerla | `400` con mensaje de validación. |
| Se cambia la contraseña con lectores conectados | Sus concesiones dejan de ser válidas en la siguiente carga. |
| Se mueve o renombra el documento | La identidad (`documentId`) no cambia, por lo que la protección y las concesiones persisten. |
| Se elimina el documento | La fila de `document_access` desaparece por cascada. |
| Nanobook pasa de privado a público (o al revés) | Sin efecto sobre `secured`; ambas reglas se componen: primero visibilidad del nanobook, luego protección del documento. |
| Navegador sin cookies | El desbloqueo no puede persistir; el formulario muestra un mensaje indicando que se necesitan cookies. |

## Pruebas

- **Dominio:** `PasswordAccessPolicy` (propietario, concesión válida, expirada, versión antigua, sin hash).
- **Infraestructura:** scrypt (hash distinto por sal, verificación correcta e incorrecta), codec de concesión (firma manipulada, expiración, documento distinto, versión), limitador (umbral, reinicio, ventana).
- **Aplicación:** `SetDocumentPassword`, `ClearDocumentPassword`, `UnlockDocument` con repositorios en memoria.
- **Rutas:** el cuerpo del `401` no contiene contenido, descripción ni encabezados; `no-store` y `noindex`; `429` y `403` genéricos; el propietario pasa sin cookie.
- **Navegación:** `projectNavigationForViewer` elimina campos sensibles y conserva título y ruta.
- **Proxy:** un proxy a un documento protegido exige concesión.
- **Regresión:** `UpdateDocument` no permite activar ni desactivar `secured` editando el frontmatter.

## Extensión futura

- Nueva `DocumentAccessPolicy` que combine concesiones por usuario o nivel con la contraseña, sin cambiar rutas ni formulario.
- Herencia por subárbol como atributo explícito (`securedScope`), con reglas de precedencia.
- Duraciones por documento o por nanobook, renovación deslizante y «recordarme».
- Registro de auditoría de desbloqueos y de cambios de contraseña.
