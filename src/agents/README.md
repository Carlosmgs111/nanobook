# Agentes

> Herramientas de agente sobre nanobooks y documentos, expuestas como servidor MCP remoto (`POST /mcp`, OAuth delegado) o local por STDIO, con auditoría de escrituras.

**Nivel:** Capa superior  ·  **Entornos:** server

## Qué hace
- Define `AgentToolService`: casos de uso que un agente puede ejecutar en nombre de un usuario (listar/leer/crear/actualizar nanobooks y documentos, guía y validación de bloques Markdown).
- Traduce el token OAuth verificado a un `AgentActor` (`actorId`, `oauthClientId`, `scopes`) con `readMcpActor`.
- Registra las herramientas en un `McpServer` por solicitud (`createNanobookMcpServer`) con esquemas `zod` e instrucciones para el cliente (`NANOBOOK_MCP_INSTRUCTIONS`).
- Exige dos controles: scope OAuth (`nanobooks:read` / `nanobooks:write`) y autorización por recurso vía `Authorizer`.
- Audita en base de datos cada escritura correcta (`agent_operation_audit`).
- Avisa (sin bloquear el guardado) de bloques inválidos y de cuerpo escrito en documentos índice.
- NO expone eliminaciones; NO gestiona OAuth/CIMD (lo hace `auth`); NO conoce los bloques financieros (los recibe por el puerto `MarkdownBlockAdvisor`); NO puede superar contraseñas de documento.

## Cómo está construido
```text
src/agents/server/
  application/
    AgentToolService.ts      # casos de uso del agente
    dto.ts                   # AgentActor, CreateDocumentInput, UpdateDocumentInput
    errors.ts                # AgentScopeDeniedError
    indexDocumentAdvice.ts   # indexBodyWarning(path, content)
    ports/                   # AgentAuditWriter, MarkdownBlockAdvisor
  infrastructure/
    mcp/                     # createNanobookMcpServer, McpToolResult (toMcpToolResult, toMcpTextResult, formatBlockIssues, joinNotes)
    oauth/                   # McpActorReader (readMcpActor, InvalidMcpActorClaimsError)
    stdio/                   # startStdioMcpServer, createStdioActor (canal local por STDIO)
    audit/                   # DrizzleAgentAuditWriter
    database/                # DrizzleAgentAuditSchema (tabla agent_operation_audit)
  index.ts                   # AgentModule (compositor)
```
Nota: este módulo usa `infrastructure/` (con "u"), distinto del `infraestructure/` de `profiles`; AGENTS.md admite ambas grafías.
- **application:** `AgentToolService(nanobooks, audit, blocks, authorizer)`. Delega en `NanobookModule` y en `nanobooks.documentModule`.
- **Puertos:** `AgentAuditWriter.write(entry)` (adaptador `DrizzleAgentAuditWriter`); `MarkdownBlockAdvisor` con `guide(): string` y `validate(content): readonly MarkdownBlockIssue[]` (lo implementa `FinancialContentModule.markdownBlockAdvisor`, inyectado por la raíz).
- **Persistencia:** tabla `agent_operation_audit` (`id`, `actor_id`, `oauth_client_id`, `tool_name`, `nanobook_id`, `document_id` nullable, `request_id`, `occurred_at`; índice por `actor_id`).
- **Eventos / caché:** no aplica.
- **Librerías:** `@modelcontextprotocol/server` (`McpServer`, `createMcpHandler`), `zod`, `jose` (tipo `JWTPayload`), `@better-auth/mcp` (`requireMcpAuth`, en la ruta), `drizzle-orm`.

### Herramientas MCP (nombres exactos y parámetros)
Servidor `nanobook` (versión `0.5.1`, igual a `package.json`, pero fijada a mano en el código). Todos los ids/paths son `string` no vacíos.

| Herramienta | Parámetros | Scope | Autorización de recurso |
|---|---|---|---|
| `list_nanobooks` | ninguno | `nanobooks:read` | filtra por `actor.actorId` |
| `get_nanobook` | `nanobookId` | `nanobooks:read` | `read` sobre el nanobook |
| `create_nanobook` | `name`, `slug`, `visibility?` (`public`\|`private`) | `nanobooks:write` | propio caso de uso; audita |
| `update_nanobook` | `nanobookId`, `name?`, `slug?`, `visibility?` | `nanobooks:write` | lo decide `NanobookModule.updateNanobook`; audita |
| `list_documents` | `nanobookId` | `nanobooks:read` | `read`; solo documentos legibles |
| `get_document` | `nanobookId`, `path` | `nanobooks:read` | `read`; si el documento pide contraseña, `AccessDeniedError` |
| `get_markdown_blocks_guide` | ninguno | `nanobooks:read` | no aplica (texto estático) |
| `validate_markdown_blocks` | `content` | `nanobooks:read` | no aplica; devuelve `{ valid, issues }` |
| `create_document` | `nanobookId`, `path`, `title`, `description`, `content`, `author?`, `cover?`, `tags?` (string[]), `draft?`, `position?` (int) | `nanobooks:write` | `write`; audita |
| `update_document` | los de `create_document` + `id`, `expectedRevision?` (int > 0) | `nanobooks:write` | `write`; audita |

`create_document` y `update_document` guardan siempre y añaden un aviso en la respuesta si hay bloques inválidos o si se escribe cuerpo en un índice (`index` o `…/index`). `author` por defecto es `actor.actorId`.

## Cómo se usa
- Punto de entrada: `server/index.ts` exporta `AgentModule`, `AgentToolService`, `AgentScopeDeniedError` y los tipos `AgentActor`, `CreateDocumentInput`, `UpdateDocumentInput`, `MarkdownBlockAdvisor`, `MarkdownBlockIssue`. `AgentModule.create(nanobooks, blocks, authorizer)` crea `AgentToolService` con `DrizzleAgentAuditWriter(db)` y lo expone como `tools`. `Application.create()` lo compone al final, tras `FinancialContentModule` (que provee el `MarkdownBlockAdvisor`).
- Endpoint `src/pages/mcp.ts` (`prerender = false`, solo `POST`): 
  ```ts
  requireMcpAuth(app.authServerModule.auth, async (req, claims) => {
    const actor = readMcpActor(claims);
    const handler = createMcpHandler(
      () => createNanobookMcpServer(actor, app.agentModule.tools),
      { legacy: "stateless", responseMode: "json" }
    );
    return handler.fetch(req);
  }, { resource, challengeScopes: ["nanobooks:read", "nanobooks:write"] })(request);
  ```
  Se crea un `McpServer` nuevo por solicitud (stateless, respuesta JSON). `resource` = `new URL("/mcp", BETTER_AUTH_URL)` vía `getMcpOAuthConfig`.
- Descubrimiento OAuth (delegado a Better Auth): `src/pages/.well-known/oauth-protected-resource/[...resource].ts` y `src/pages/.well-known/oauth-authorization-server/[...issuer].ts` exportan `GET = app.authServerModule.authController`. Páginas de login y consentimiento: `/login` y `/consent` (`McpOAuthConfig`).
- OAuth/CIMD (configurado en `src/auth/server/infrastructure/better-auth/BetterAuth.ts`, no en este módulo): plugins `jwt()`, `mcp()` con scopes `nanobooks:read`, `nanobooks:write`, `offline_access` (access token 15 min, refresh 30 días, `refreshTokenReuseInterval: 0`) y `cimd()` con `metadataProfile: "mcp-2026-07-28"`. Solo se admiten como `client_id` los metadatos CIMD de Claude (`https://claude.ai/oauth/mcp-oauth-client-metadata`) y de Codex (`https://chatgpt.com/oauth/client.json`, `/oauth/<x>/client.json` o `/oauth/codex/<x>/client.json`, sin puerto, query ni fragmento), según `isAgentClientMetadataUrlAllowed`. Fuera de loopback el recurso MCP exige HTTPS.
- Claims requeridos del token (`readMcpActor`): `sub` (string), `client_id` (string) y `scope` (string separado por espacios); si falta alguno lanza `InvalidMcpActorClaimsError`.

### Canal STDIO (local)
Mismo servidor y mismas diez herramientas, pero el cliente lanza el proceso en la propia máquina y habla por la entrada/salida estándar: sin HTTP ni OAuth. Lo compone `scripts/mcp-stdio.ts` (raíz de composición propia, sin Astro: usa `tsconfig.mcp.json` y un *shim* de `astro:env/server`).

- Identidad: el usuario local cuyo correo indica `NANOBOOK_MCP_USER_EMAIL` (debe existir en la base). Actúa con `nanobooks:read` y `nanobooks:write`; el `Authorizer` se aplica igual, y las escrituras quedan auditadas con `oauth_client_id = "stdio-local"`.
- Base de datos: la de `DATABASE_URL` (`.env`) o, con `mcp:stdio:staging`, la de `.env.staging`. El destino se imprime por stderr al arrancar.
- stdout es el canal del protocolo: el script redirige `console.log/info/debug/warn` a stderr, y hay que lanzarlo con `pnpm --silent` para que pnpm no escriba su cabecera.
- Cliente (ejemplos; ajusta la ruta del repositorio y el correo):

```powershell
# Claude Code
claude mcp add nanobook-local --env NANOBOOK_MCP_USER_EMAIL=tu@correo.com -- pnpm --silent --dir D:utaa
anobook run mcp:stdio
# Codex
codex mcp add nanobook-local --env NANOBOOK_MCP_USER_EMAIL=tu@correo.com -- pnpm --silent --dir D:utaa
anobook run mcp:stdio
```

```json
{ "mcpServers": { "nanobook-local": {
  "command": "pnpm",
  "args": ["--silent", "--dir", "D:\ruta\a\nanobook", "run", "mcp:stdio"],
  "env": { "NANOBOOK_MCP_USER_EMAIL": "tu@correo.com" } } } }
```

## Dependencias
- **Depende de:** `nanobooks` (`NanobookModule`: listar/crear/actualizar nanobooks y `documentModule`), `documents` (`serializeEntry`, `DocumentNotFoundError`, `DocumentPath`), `authorization` (`Authorizer`, `Subject`, `AccessDeniedError`, `AccessCheckFailedError`), `shared` (`Result`, `db`), `auth` (solo en `pages/mcp.ts`: `requireMcpAuth`, `McpOAuthConfig`), `financial-content` (indirecto, vía el puerto `MarkdownBlockAdvisor` inyectado por `application`).
- **Lo usan:** `application` (compone `AgentModule`) y `pages/mcp.ts`.
- Acoplamientos a vigilar: `AgentToolService` importa tipos concretos de `documents/server/...` y `nanobooks/server/domain/types` (no solo contratos públicos); `pages/mcp.ts` importa directamente de `agents/.../infrastructure/` y de `auth/.../infrastructure/better-auth/`. Comentario `TODO` en `index.ts`: falta un mecanismo para que otros módulos registren sus propias tools.

## Seguridad y autorización
- Canal STDIO: no hay autenticación propia; la confianza es la del sistema operativo (quien puede lanzar el proceso actúa como el usuario configurado). Úsalo solo en tu máquina; para accesos remotos está el canal HTTP con OAuth.
- Capa 1, scopes: `AgentToolService.has/require` falla con `AgentScopeDeniedError` si el token no incluye `nanobooks:read` o `nanobooks:write`.
- Capa 2, recurso: `authorizer.require({ subject: Subject.of(actorId), action: "read"|"write", resource: { type: "nanobook", id } })`; las políticas (`NanobookAccessPolicy`, `DocumentPasswordPolicy`) las registra `nanobooks`/`documents`, no este módulo. `agents` solo consume `Authorizer` y `Subject`, conforme a AGENTS.md.
- `get_document` usa un `viewer` sin grants: un documento protegido por contraseña se trata como acceso prohibido (`challenge` -> `AccessDeniedError`).
- Tokens de corta vida (15 min); autenticación verificada en cada solicitud; cada escritura exitosa deja `actorId`, `oauthClientId`, `toolName`, `nanobookId`, `documentId` y `requestId` (UUID) en `agent_operation_audit`. Las lecturas no se auditan.
- Protección de origen/CSRF del canje OAuth en el monolito: ver decisión enlazada.

## Pruebas
Junto al código: `server/application/AgentToolService.test.ts`, `.read.test.ts`, `.write.test.ts`, `indexDocumentAdvice.test.ts`, `server/infrastructure/mcp/createNanobookMcpServer.test.ts`, `McpToolResult.test.ts`, `server/infrastructure/oauth/McpActorReader.test.ts`; relacionadas: `src/auth/server/infrastructure/better-auth/McpOAuthConfig.test.ts` y los tests de `src/pages/.well-known/**`.
Ejecutar: `npx vitest run src/agents`.

## Decisiones y límites conocidos
- Pendientes: registro de tools por otros módulos (`TODO` en `server/index.ts`); no hay eliminaciones ni auditoría de lecturas.
