# Diseño: perfiles públicos, auth y documentos por propietario

## Propósito

Crear `profiles` como un módulo nuevo e independiente, cuyo único cometido es representar el perfil público de una identidad autenticada. Cada perfil aporta un `username` inmutable que permite navegar documentos públicos por propietario, sin convertir ese nombre en una credencial ni en la base de la autorización.

## Decisiones

1. Better Auth conserva la identidad: credenciales, correo, verificación, sesión y el identificador estable `user.id`.
2. `profiles` conserva los datos públicos y una relación uno-a-uno con esa identidad mediante `user_profile.user_id`.
3. `Document.ownerId` continúa almacenando el `user.id` de Better Auth. Nunca almacena ni autoriza mediante `username`.
4. `username` se normaliza a minúsculas, es único e inmutable en esta versión. El patrón será `^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$` (3 a 32 caracteres); futuros cambios requerirán una política de alias y redirecciones.
5. Un perfil es opcional hasta que la persona lo crea, pero todas las mutaciones de documentos requieren una sesión autenticada, correo verificado y perfil con username.
6. `profiles` no depende ni migra datos del módulo legado `users`. Una vez reemplazadas sus referencias de composición y rutas, el código legado se retira del repositorio sin transformar datos.

## Modelo y persistencia

La tabla nueva pertenece a la infraestructura de `profiles`:

```text
user_profile
  user_id       TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE
  username      TEXT NOT NULL UNIQUE
  display_name  TEXT NOT NULL
  created_at    INTEGER NOT NULL
  updated_at    INTEGER NOT NULL
```

El esquema de Drizzle de profiles declara la clave foránea hacia la tabla `user` de Better Auth. Es una dependencia física de persistencia, no una dependencia entre sus capas de dominio o aplicación. `drizzle.config.ts` incluirá ambos esquemas y la migración creará la tabla e índice único.

El perfil se crea explícitamente; Better Auth no inventa usernames. Esta entrega no aprovisiona ni transforma perfiles o datos existentes.

## Límites y composición

```text
Better Auth user(id, email, session)
             │
             │ Astro.locals.currentUserId
             ▼
AuthServerModule.protect()
             │
             ▼
ProfileModule.requireUsername()
             │
             ▼
DocumentModule mutation routes ── ownerId check ──> documentos
```

`AuthServerModule.protect()` exige una sesión y correo verificado, y deja el actor en `Astro.locals`. `ProfileModule.requireUsername()` solo comprueba que ese actor tiene un perfil con username. No consulta Better Auth. `DocumentModule` conserva su autorización por `ownerId` y no conoce perfiles ni usernames.

`Application` es el único lugar que compone los dos decoradores, respetando el orden:

```ts
authServerModule.protect(profileModule.requireUsername(route));
```

El mismo principio evita dependencias inversas: auth no importa profiles, y profiles no importa documents. Una consulta de perfil puede recibir un puerto de lectura de documentos en el compositor cuando necesite construir una vista pública.

## Alineación con los módulos existentes

`profiles` se divide en dos módulos por entorno, siguiendo la separación que ya usa `auth`: `server/profiles` contiene dominio, aplicación, persistencia, controladores y composición; `browser/profiles` contiene los adaptadores HTTP, controladores y componentes Astro del navegador. Ninguno importa implementaciones del otro:

```text
src/server/profiles/
  domain/            entidad, value objects, errores y puertos
  application/       casos de uso y puertos consumidores
  infraestructure/   repositorio Drizzle y adaptadores REST
    repository/
    rest/
  index.ts           compositor del módulo
src/browser/profiles/
  client/            adaptadores HTTP, controladores y returnTo
  ui/                componentes Astro
```

Los controladores REST residen en `server/profiles/infraestructure/rest/`, igual que en documents. El código que usa `fetch`, `location` o DOM reside en `browser/profiles/`, conforme a la frontera de ejecución de AGENTS.md. Las capas de `server/profiles` no importan browser, y las de `browser/profiles` no importan auth ni infraestructura del servidor; exclusivamente `DrizzleProfileSchema` importa la tabla `user` exportada por el esquema Drizzle de auth para declarar la clave foránea física.

`ProfileModule.create(routeProtector)` recibe el contrato mínimo `RouteProtector` que ya consume DocumentModule y compone sus rutas privadas. Application crea primero auth, después profiles, y compone el protector de documentos sin acoplar los módulos:

```ts
const profileModule = await ProfileModule.create(authServerModule);
const documentRouteProtector: RouteProtector = {
  protect: (route) => authServerModule.protect(profileModule.requireUsername(route)),
};
const documentModule = await DocumentModule.create(eventBus, documentRouteProtector);
```

Para consultas públicas, profiles define en `application/ports/` el puerto consumidor `PublicDocumentsReader`. Después de construir ProfileModule y DocumentModule, Application adapta las capacidades de lectura de DocumentModule a ese puerto y construye el controlador/consulta pública compuesta. Así profiles expresa lo que necesita (`listByOwnerId` y `getByPublicPathForOwner`) sin importar documents desde dominio o aplicación, sin crear un ciclo de construcción entre módulos.

## Capacidades de profiles

```text
CreateCurrentProfile(actorId, { username, displayName })
GetCurrentProfile(actorId)
UpdateCurrentProfile(actorId, { displayName })
GetPublicProfileByUsername(username)
RequireUsername(route)
```

`CreateCurrentProfile` toma el actor del contexto, nunca de un cuerpo HTTP. Rechaza perfiles duplicados para el actor y usernames ya ocupados. `UpdateCurrentProfile` no incluye `username` en su DTO, por lo que la inmutabilidad forma parte del contrato, no solo de la UI.

## Contrato REST

Rutas privadas, decoradas por auth y profiles cuando corresponde:

| Método | Ruta | Resultado |
| --- | --- | --- |
| `GET` | `/api/me/profile` | Perfil propio, o `404` si todavía no existe. |
| `POST` | `/api/me/profile` | Crea `{ username, displayName }`; `201`. Solo requiere auth verificada, para poder completar el alta. |
| `PATCH` | `/api/me/profile` | Actualiza `{ displayName }`; `200`. |
| `POST` | `/api/me/documents/:documentId` | Crea documento; exige auth verificada y username. |
| `PATCH` | `/api/me/documents/:documentId` | Actualiza o renombra; exige auth verificada, username y propiedad. |
| `DELETE` | `/api/me/documents/:documentId` | Elimina; exige auth verificada, username y propiedad. |

Rutas públicas:

| Método | Ruta | Resultado |
| --- | --- | --- |
| `GET` | `/api/profiles/:username` | Proyección pública del perfil. |
| `GET` | `/api/profiles/:username/documents` | Documentos cuyo `ownerId` coincide con el perfil. |

Los resultados privados no exponen correo, sesión, ni identidad editable. Las rutas públicas no exponen `userId` ni email.

Errores previstos:

- `400`: username o cuerpo inválido.
- `401`: no hay sesión válida.
- `403`: hay sesión, pero el correo no está verificado o no existe propiedad sobre el documento.
- `404`: perfil o documento inexistente.
- `409`: username ocupado o perfil ya creado para el actor.
- `428`: falta perfil con username para mutar documentos.

La respuesta `428` será estable y accionable:

```json
{
  "code": "PROFILE_REQUIRED",
  "message": "Debes elegir un nombre de usuario antes de crear o modificar documentos.",
  "setupUrl": "/profile"
}
```

## Rutas y comportamiento de UI

```text
/profile                       perfil propio
/u/:username                   perfil público y listado de documentos
/u/:username/:documentPath     documento público de ese perfil
```

`/profile` permite crear el perfil cuando no existe y cambiar solamente `displayName` cuando sí existe. El username se presenta como lectura. El alta de perfil recibe un `returnTo` opcional; se acepta únicamente una ruta relativa local para evitar redirecciones abiertas.

Las rutas públicas resuelven primero el perfil y después verifican que el documento corresponde a su `userId`. Las nuevas URLs con username serán canónicas. Las rutas públicas actuales `/:documentPath` se preservan inicialmente como compatibilidad y podrán redirigir cuando todos los propietarios tengan perfiles provisionados.

Los controles de creación, edición, renombrado y borrado se muestran solo al actor verificado que coincide con `ownerId`. Al intentar crear sin perfil, la UI navega a `/profile?returnTo=…`. Si el servidor devuelve `PROFILE_REQUIRED` durante una mutación, el editor conserva el borrador local y realiza la misma navegación; el servidor sigue siendo la barrera de seguridad.

## Implementación sin migración de usuarios

1. Crear el esquema y la migración de base de datos `user_profile`; esta migración solo añade la tabla nueva y no transforma datos existentes.
2. Añadir las rutas `/api/me/profile`, `/api/profiles/:username`, `/api/me/documents/*` y las páginas `/u/:username/*`.
3. Retirar el módulo y las rutas `users` después de comprobar que `Application` y las rutas Astro no los referencian.
4. Conservar las rutas públicas actuales de documentos durante este incremento, sin redirecciones canónicas ni aprovisionamiento de propietarios existentes.

## Pruebas

- Dominio: normalización, patrón e inmutabilidad de `username`; conservación de auditoría y `userId`.
- Aplicación: creación con actor, duplicados de actor/username, actualización de `displayName`, consultas públicas y ausencia de perfil.
- Repositorio Drizzle: persistencia, índice único y borrado en cascada de perfil al borrar la identidad.
- HTTP: `401`, `403`, `404`, `409` y `428`, sin aceptar `userId` ni username en mutaciones de documento.
- Composición: el orden `auth → profile → document` y que ningún decorador llama capacidades internas del otro módulo.
- UI: alta de perfil, username de solo lectura, `returnTo` local, redirección por perfil faltante y controles visibles solo al propietario verificado.
- Rutas públicas: resolución username a perfil y rechazo de documentos cuyo propietario no coincide.

## Fuera de alcance

- Cambiar username, historial de aliases y redirecciones permanentes.
- Perfiles privados, biografía, avatar, seguidores o listado global de usuarios.
- Roles colaborativos sobre documentos.
- Convertir username en método de autenticación.
