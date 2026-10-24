---
title: "Diseño: administración de Nanobook mediante MCP"
date: 2026-10-24
status: proposed
---

# Diseño: administración de Nanobook mediante MCP

## Intención

Permitir que un agente compatible con MCP administre, en nombre de una
persona, sus nanobooks y documentos mediante herramientas tipadas. La
integración no reutiliza ni expone las cookies de sesión del navegador. Cada
conexión de agente representa una delegación revocable de la identidad de la
persona que la autorizó.

La primera entrega cubre lectura y mutaciones constructivas: crear y actualizar
nanobooks y documentos. No incorpora borrados, colaboración, organizaciones,
permisos por documento, transferencia de contenido ni acceso directo a SQL.

## Objetivos

- Un usuario de Nanobook puede autorizar un host de agente compatible con MCP
  desde el navegador.
- El agente actúa con el `userId` del usuario que autorizó la conexión, nunca
  con un `userId` enviado en argumentos de una herramienta.
- El agente puede operar todos los nanobooks que posea ese usuario, aplicando
  la misma política de lectura/escritura de Nanobook.
- Las herramientas son transportables entre hosts MCP y no exponen rutas HTTP,
  cookies, secretos ni detalles de Drizzle al modelo.
- Las mutaciones conservan validación de dominio, revisiones optimistas y
  autorización del nanobook.
- El usuario puede revocar una conexión; la siguiente llamada del agente deja
  de ser válida.

## No objetivos de la primera entrega

- Eliminar nanobooks o documentos desde un agente.
- Conceder acceso a un subconjunto de nanobooks dentro de una conexión.
- Compartir la cookie de Better Auth, contraseñas, tokens de GitHub o tokens de
  base de datos con el agente o con el modelo.
- Crear un puente que conecte directamente a la base SQL.
- Soportar agentes sin una interacción de autorización del usuario.
- Añadir herramientas de tema, perfiles, publicación o gestión de usuarios.

## Modelo de módulos

Se crea el módulo `src/agents/server/`. Es un adaptador de entrada, no un nuevo
dominio de contenido:

```text
src/agents/server/
  application/        # catálogo de herramientas y orquestación por actor
  infrastructure/
    mcp/               # transporte MCP HTTP y mapeo JSON-RPC
    oauth/             # verificación de tokens y metadatos de recurso
    audit/             # registro de mutaciones de herramientas
  index.ts             # composición del módulo
```

`Application` compone `AgentModule` con las capacidades públicas mínimas de
`NanobookModule`, `DocumentModule` y `AuthServerModule`. El módulo no importa
repositorios Drizzle ni construye una segunda aplicación. Las herramientas
llaman casos de uso y consultas de aplicación, igual que las rutas Astro.

Como MCP es otro adaptador de entrada, la comprobación de acceso a nanobook se
extrae a una capacidad de aplicación reutilizable. La ruta HTTP actual y las
herramientas MCP la invocan antes de mutar documentos. `AuthorizeNanobook`
sigue siendo dueño de la regla; `agents` no define reglas de propiedad.

## Identidad, conexión y duración de sesión

Nanobook se convierte en proveedor OAuth 2.1 y recurso protegido para el
endpoint MCP. Better Auth mantiene la sesión de navegador para el login y la
pantalla de consentimiento, pero esa cookie no viaja al agente.

El host MCP es el cliente OAuth. La primera vez que se conecta:

1. El host descubre que el endpoint MCP requiere autorización.
2. Abre el navegador en Nanobook y el usuario inicia sesión o reutiliza su
   sesión de Better Auth.
3. Nanobook presenta el consentimiento para los scopes
   `nanobooks:read` y `nanobooks:write`.
4. Tras aprobar, el host intercambia un código de autorización protegido por
   PKCE por un access token y un refresh token.
5. El host guarda los tokens en su almacén seguro; el modelo no recibe sus
   valores.

El access token es de corta duración (15 minutos, decisión de esta propuesta).
El refresh token permite obtener uno nuevo sin mostrar el navegador mientras la
conexión siga autorizada. Su duración es de 30 días y rota en cada uso. Una
revocación en Nanobook invalida el grant y los refresh tokens asociados; los
access tokens emitidos expiran como máximo en 15 minutos. Esta ventana es un
compromiso explícito entre desconexión inmediata y no consultar persistencia en
cada llamada; el recurso MCP sí consulta el estado activo del grant antes de
aceptar cada token para conseguir revocación inmediata.

Cada llamada MCP HTTP incluye `Authorization: Bearer <access-token>`. El
recurso verifica firma, emisor, audiencia del endpoint MCP, vencimiento, grant
activo y scopes. Extrae `sub` como `actorId` y lo entrega a la capacidad de
aplicación. No se aplica la comprobación `Origin` usada para cookies: un bearer
token no depende del navegador y se protege por confidencialidad del token y
HTTPS.

Las credenciales de máquina (`client_credentials`) quedan fuera del alcance:
la primera versión es siempre una delegación de un usuario humano.

## Herramientas MCP

Todas las herramientas devuelven datos de aplicación serializables, sin email,
cookies ni tokens. Los argumentos se validan con esquemas Zod antes de llamar a
un caso de uso.

| Herramienta | Scope | Operación |
| --- | --- | --- |
| `list_nanobooks` | `nanobooks:read` | Lista nanobooks del actor. |
| `get_nanobook` | `nanobooks:read` | Lee un nanobook visible para el actor. |
| `create_nanobook` | `nanobooks:write` | Crea un nanobook y su raíz. |
| `update_nanobook` | `nanobooks:write` | Modifica nombre, slug o visibilidad de un nanobook propio. |
| `list_documents` | `nanobooks:read` | Lista documentos del nanobook autorizado. |
| `get_document` | `nanobooks:read` | Lee un documento del nanobook autorizado. |
| `create_document` | `nanobooks:write` | Crea un documento dentro de un nanobook propio. |
| `update_document` | `nanobooks:write` | Actualiza o renombra un documento, con `expectedRevision` opcional. |

Una herramienta de escritura primero verifica el scope OAuth, después el
permiso `write` sobre el nanobook mediante `AuthorizeNanobook`, y finalmente
ejecuta el caso de uso. Una herramienta de lectura verifica `read` antes de
consultar contenido. Los errores conservan una semántica uniforme: `401` para
token ausente o inválido, `403` para scope o permiso insuficiente, `404` para
un recurso no visible y `409` para conflictos de revisión.

## Transporte MCP

Nanobook expone un único endpoint MCP HTTP, `POST /mcp`, con el transporte
Streamable HTTP del SDK oficial MCP. Adopta el perfil MCP `2026-07-28`: cada
solicitud JSON-RPC es independiente, se crea un servidor MCP por solicitud y
se rechaza el protocolo legacy orientado a sesión. El endpoint implementa el
ciclo `initialize`, `tools/list` y `tools/call` definido por MCP. No es una API
HTTP paralela de negocio: traduce cada llamada JSON-RPC a una herramienta del
módulo `agents`.

El endpoint también expone los metadatos OAuth de recurso protegido requeridos
para que clientes compatibles descubran el servidor de autorización. Better
Auth expone la metadata del servidor de autorización. La primera integración
usa Client ID Metadata Documents (CIMD) para identificar al único cliente MCP
admitido y PKCE para la autorización; no habilita Dynamic Client Registration.
El perfil de metadata, la URL del documento del cliente y sus redirect URIs se
declaran explícitamente para desarrollo y producción.

## Persistencia y auditoría

El proveedor OAuth añade las tablas y migraciones que requiere Better Auth. El
módulo `agents` añade un registro de auditoría mínimo para mutaciones exitosas:

```text
agent_operation_audit
  id, actor_id, oauth_client_id, tool_name, nanobook_id,
  document_id nullable, occurred_at, request_id
```

No se guardan cuerpos Markdown, access tokens ni refresh tokens en esta tabla.
El `request_id` permite relacionar una operación con sus logs sin duplicar
contenido. El mecanismo de reintento se diseña después; en esta entrega los
clientes deben tratar un timeout de escritura como resultado indeterminado y
consultar el estado antes de reintentar.

## Cambios de autenticación existentes

`AuthServerModule` conserva `protect()` para rutas de navegador basadas en
cookie. Se añade una capacidad separada para el recurso MCP que valida bearer
tokens y produce el mismo actor de aplicación. Las rutas de navegador no
aceptan tokens MCP por accidente y el endpoint MCP no acepta cookies como
credencial de máquina.

La configuración de Better Auth incorpora `jwt()`, `mcp()` y `cimd()`; el
plugin MCP ya configura el proveedor OAuth 2.1 y el recurso protegido, por lo
que no se registra un segundo proveedor OAuth. Se actualiza Better Auth de
`1.7.7` a una versión compatible con estos plugins, junto con
`@better-auth/mcp`, `@better-auth/cimd` y el SDK oficial MCP v2. Las nuevas
tablas se generan en Drizzle, se añaden como migración y deben aplicarse
explícitamente en local y producción con `npm run database:migrate` antes de
activar el endpoint.

## Pruebas y aceptación

- Un cliente sin token recibe `401` y metadata que le permite descubrir la
  autorización.
- El usuario completa una autorización PKCE y el cliente obtiene un token con
  scopes aprobados.
- Una herramienta de lectura devuelve únicamente nanobooks del actor o libros
  públicos permitidos.
- Un token sin `nanobooks:write` no puede ejecutar una herramienta mutante.
- Un token de otro usuario no puede crear ni actualizar contenido en un
  nanobook ajeno, aunque conozca sus identificadores.
- Una actualización con revisión obsoleta devuelve conflicto, sin sobrescribir
  contenido.
- Revocar la conexión impide nuevas llamadas y la renovación de tokens.
- Cada mutación exitosa genera una entrada de auditoría sin contenido ni
  secretos.
- La suite completa y `npm run build` pasan tras aplicar las migraciones en una
  base efímera y en una base ya migrada.

## Decisiones posteriores

## Decisiones adoptadas

- La primera integración soporta un único cliente MCP público identificado con
  un Client ID Metadata Document, PKCE y redirect URIs explícitas para
  desarrollo y producción. El registro dinámico de clientes queda fuera de
  alcance.
- `list_*` usa un orden estable y no pagina en esta primera entrega.
  `get_*` devuelve los DTO de aplicación vigentes. `update_document` recibe el
  estado completo del documento y `expectedRevision` opcional.
- `list_nanobooks` devuelve solo libros del actor. Un agente con
  `nanobooks:read` puede obtener un nanobook o documento público ajeno solo si
  conoce su identificador o slug; el catálogo no enumera libros de terceros.
- El transporte usa `401` exclusivamente para token ausente, inválido o
  vencido. Una herramienta devuelve resultados de error estructurados para
  `403`, `404` y `409`, de modo que el host MCP pueda mostrarlos sin romper la
  sesión JSON-RPC.
- Se adopta Better Auth OAuth 2.1 Provider con JWT y resource server, tras
  verificar la compatibilidad de sus plugins con las versiones instaladas. La
  solución no se inicia si esa comprobación exige actualizar dependencias de
  manera incompatible.

## Evoluciones posteriores

- Permitir al usuario limitar una conexión a nanobooks seleccionados.
- Añadir confirmación interactiva para operaciones destructivas.
- Añadir herramientas de temas, perfiles y publicación.
- Admitir clientes OAuth registrados dinámicamente una vez probado el flujo
  con un cliente público conocido.
