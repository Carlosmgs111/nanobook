# Shared (contratos, utilidades e infraestructura transversales)

> Código compartido por varios módulos: tipos base (`Result`, eventos de dominio, bus), conexión a base de datos, guardas HTTP, cliente de GitHub, estilos globales e iconos.

**Nivel:** Núcleo transversal (no es un módulo de negocio)  ·  **Entornos:** mixto: `domain/`, `errors.ts`, `theme/`, `icons/`, `styles/` son agnósticos; `infrastructure/`, `server/`, y `github/` son solo servidor; `utils/debounce.ts` y `utils/scroll-spy.ts` son de navegador

## Qué hace
- Ofrece los contratos puros que usan todos los módulos: `Result`, `DomainEvent`, `EventBus`, `InfrastructureError`, `ThemeReference`.
- Provee implementaciones del bus de eventos (en memoria y basada en `EventTarget`).
- Centraliza la conexión libSQL/Drizzle (`infrastructure/database`).
- Define la capacidad `RouteProtector` y las utilidades HTTP del servidor (guarda de origen, `Server-Timing`).
- Aloja estilos globales (Tailwind v4 + CSS propio) e iconos SVG compartidos por la UI.
- NO contiene lógica de negocio ni importa módulos de negocio; no debe depender de ellos.

## Cómo está construido
```text
src/shared/
  errors.ts                         # InfrastructureError (base de errores de infraestructura)
  domain/
    Result.ts                       # Result<E, T>: ok()/fail(), isSuccess, getValue(), getError()
    DomainEvent.ts                  # Clase base abstracta (name, id, timestamp)
    bus/EventBus.ts                 # Puertos EventBus, EventHandler, DomainEventType
    bus/errors.ts                   # EventBusError (extiende InfrastructureError)
  infrastructure/
    InMemoryEventBus.ts             # Bus de servidor: ejecuta handlers y agrega fallos en un EventBusError; clear()
    EventTargetEventBus.ts          # Bus de navegador sobre EventTarget/CustomEvent
    database/
      createDatabase.ts             # createDatabase({ url, authToken }) -> { client, db } (@libsql/client + drizzle-orm)
      databaseConfig.ts             # getDatabaseOptions(env): DATABASE_URL (def. file:./data/nanobook.db), DATABASE_AUTH_TOKEN; en Vercel exige libsql(s)://
      drizzleDatabase.ts            # Singleton `{ client, db }` creado al importar
  server/
    capabilities/RouteProtector.ts  # Interfaz protect(handler: APIRoute): APIRoute
    http/BrowserMutationOriginGuard.ts  # rejectCrossOriginBrowserMutation, UNSAFE_HTTP_METHODS
    http/ServerTiming.ts            # formatServerTiming, appendServerTiming
  github/api.ts                     # fetchFileContent({ owner, repo, branch, path, token? }): API con token, raw.githubusercontent.com sin token
  theme/ThemeReference.ts           # ThemeReference (official | custom) + guarda isThemeReference
  utils/
    debounce.ts                     # debounce(callback, delay)
    scroll-spy.ts                   # findActiveIndex(scrollY, offsets, offset=120) por búsqueda binaria
    documentPath.ts                 # toDocumentId(filePath, { basePath, lowercase })
  icons/                            # SVG (chevrons, file, folder, home, list, lock, maximize, menu, moon, sun, x...)
  styles/                           # global.css importa base.css, utilities.css, prose.css y components/hatch.css; components/index-card.css se importa aparte
```

- Puertos definidos: `EventBus`/`EventHandler` (`domain/bus`) y `RouteProtector` (`server/capabilities`). Implementan `EventBus`: `InMemoryEventBus` y `EventTargetEventBus`. `RouteProtector` lo implementa `AuthServerModule` (módulo `auth`).
- Eventos: define solo la base `DomainEvent`; los eventos concretos viven en cada módulo.
- Persistencia/servicios externos: libSQL/Turso (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`), GitHub (`api.github.com` / `raw.githubusercontent.com`).
- Librerías: `@libsql/client`, `drizzle-orm`, `astro` (tipos `APIRoute`).

## Cómo se usa
- Resultado tipado en casos de uso: `return Result.fail(new MyError())` / `Result.ok(value)`; el consumidor comprueba `isSuccess` antes de `getValue()`/`getError()`.
- Eventos: un evento extiende `DomainEvent`; se suscribe con `bus.subscribe(EventClass, handler)` (el evento expone `static eventName`) y se emite con `await bus.publish(event)`.
- Base de datos: los compositores de servidor importan `db`/`client` de `shared/infrastructure/database/drizzleDatabase` (o usan `createDatabase` en pruebas).
- Origen/tiempos: `src/middleware.ts` usa `rejectCrossOriginBrowserMutation` y `appendServerTiming`; `pages/n/.../index.astro` usa `formatServerTiming`.
- Estilos: los layouts (`layouts/Layout.astro`, `layouts/LandingLayout.astro`) importan `shared/styles/global.css`; `navigation/.../DocumentIndex.astro` importa `components/index-card.css`.
- Iconos: se importan los `.svg` desde `shared/icons/` en componentes de `navigation`, `theme`, `layouts` y la tabla de contenidos.
- Sin `index.ts` ni composición: cada consumidor importa el archivo que necesita; `Application` no lo compone.

### Quién usa qué
| Subcarpeta | Consumidores |
|---|---|
| `domain/Result`, `domain/DomainEvent` | `documents` (server y browser), `nanobooks`, `theme`, `profiles`, `rendering`, `agents`, `navigation` |
| `domain/bus` | `documents`, `rendering`, `navigation`, `nanobooks` |
| `errors.ts` | `documents` (server/browser), `rendering` (errores de infraestructura) |
| `infrastructure/InMemoryEventBus` | `application/server`, `documents`, `nanobooks`, `rendering`, `navigation` |
| `infrastructure/EventTargetEventBus` | `documents/browser` |
| `infrastructure/database` | `nanobooks`, `documents`, `theme`, `spreadsheets`, `profiles`, `auth`, `agents` |
| `server/capabilities` | `application/server`, `auth` (implementa), `profiles`, `theme` |
| `server/http` | `middleware.ts`, `pages/n/.../index.astro`, `documents/browser/ui/pages` |
| `github/api` | `documents/server/infraestructure/reference/GitHubReferenceResolver` |
| `theme/ThemeReference` | `theme`, `nanobooks` |
| `utils/debounce`, `utils/scroll-spy` | `documents/browser/ui/components` (editor, `TableOfContents`) |
| `utils/documentPath` | Sin importadores en `src/` (solo mencionados en documentación) |
| `icons`, `styles` | `layouts`, `navigation/browser`, `theme/browser`, `documents/browser`, `financial-content/browser` |

## Dependencias
- **Depende de:** librerías externas (`@libsql/client`, `drizzle-orm`, `astro`). Dentro de `src/` solo se referencian entre sí (`domain/bus` -> `errors.ts`, `infrastructure` -> `domain`, `database` -> `databaseConfig`).
- **Lo usan:** casi todos los módulos (tabla anterior).
- Acoplamiento a vigilar: `shared/server/` y `shared/infrastructure/database` cargan I/O y APIs de Node: no importarlos desde `browser/`. `shared/utils/documentPath.ts` no tiene uso actual (posible código muerto).

## Seguridad y autorización
- `RouteProtector` es el único contrato de autenticación de rutas; el módulo `shared` no decide acceso ni importa `authorization`.
- `BrowserMutationOriginGuard` mitiga CSRF: rechaza con 403 mutaciones `POST/PUT/PATCH/DELETE` con `Sec-Fetch-Site` no `same-origin` u `Origin` distinto del confiable.
- `createDatabase` no expone credenciales; `getDatabaseOptions` impide un `DATABASE_URL` local en Vercel.
- `github/api.ts` usa `Authorization: Bearer` solo si hay token.

## Pruebas
- Junto al código: `infrastructure/database/createDatabase.test.ts`, `infrastructure/database/databaseConfig.test.ts`, `server/http/BrowserMutationOriginGuard.test.ts`, `server/http/ServerTiming.test.ts`.
- Ejecutar: `npx vitest run src/shared`. `Result`, buses, `github`, `utils` y `ThemeReference` no tienen pruebas propias en esta carpeta.

## Decisiones y límites conocidos
- Persistencia: el contenido vive en SQL (libSQL); GitHub solo lo usa `GitHubReferenceResolver` para documentos con `ref`. `utils/documentPath.ts` no tiene importadores en `src/` (posible código muerto).
- Diferencia de comportamiento: `InMemoryEventBus` agrega todos los fallos en un único `EventBusError`; `EventTargetEventBus` devuelve solo el primer resultado fallido.
