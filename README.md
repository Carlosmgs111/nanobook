# Nanobook

![Versión](https://img.shields.io/badge/version-0.5.1-BC52EE?style=plastic)
![Astro](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white&style=plastic)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white&style=plastic)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=plastic)
![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=nodedotjs&logoColor=white&style=plastic)
![Markdown](https://img.shields.io/badge/Markdown-000000?logo=markdown&logoColor=white&style=plastic)

Nanobook es una plataforma de documentación y publicación en Markdown. Cada usuario crea **nanobooks** (colecciones con slug, visibilidad y tema propios) que contienen **documentos** Markdown. Los documentos se editan en el navegador, se renderizan en el servidor con un pipeline extensible y pueden incluir bloques especiales (contenido financiero, hojas de cálculo). Los agentes de IA pueden gestionar nanobooks y documentos a través de un servidor MCP con OAuth.

> **Estado:** `v0.5.1`, fase alpha. Las URLs, la API y los componentes pueden cambiar hasta `v1.0.0`.

## Qué incluye

- **Nanobooks y documentos** con ciclo de vida completo, rutas jerárquicas, borrado, movimiento y protección de lectura con contraseña.
- **Editor integrado** (CodeMirror 6) con vista previa sin guardar renderizada en un Web Worker.
- **Renderizado Markdown compartido** servidor/navegador (`unified`, GFM, Shiki) con caché de páginas y huella de versión del motor.
- **Navegación** automática: sidebar, breadcrumbs, índices y tabla de contenidos.
- **Temas** oficiales y personalizados por usuario, compilados a variables CSS (`--theme-*`).
- **Autenticación** con correo verificado y GitHub OAuth opcional (Better Auth).
- **Autorización** única y centralizada (`Authorizer` + políticas registradas por cada módulo).
- **Perfiles públicos** con `username` único.
- **Acceso para agentes** mediante servidor MCP (`POST /mcp`), OAuth 2.1 + PKCE y scopes `nanobooks:read` / `nanobooks:write`.
- **Bloques opcionales:** contenido financiero (6 bloques con gráficos) y hojas de cálculo editables.

## Stack

Astro 7 (`output: "server"`) · TypeScript · Tailwind CSS 4 · Drizzle ORM + libSQL (SQLite) · Better Auth · CodeMirror 6 · unified/remark/rehype + Shiki · nanostores · Vitest. Despliegue: Vercel (`@astrojs/vercel`) o Node (`@astrojs/node`).

## Ejecutar en local

### Requisitos

- **Node.js ≥ 22.12** (probado con 24).
- **pnpm** (el repositorio incluye `pnpm-lock.yaml`; no hay `package-lock.json`). Actívalo con `corepack enable` o `npm i -g pnpm`.
- No necesitas Redis, Resend, GitHub ni Vercel para trabajar en local.

### Pasos

```bash
git clone <url-del-repo> nanobook
cd nanobook
pnpm install --frozen-lockfile
cp .env.example .env          # opcional; ver variables más abajo
pnpm run database:migrate     # crea ./data/nanobook.db (y la carpeta data/) con todas las tablas
pnpm run dev                  # http://localhost:4322
```

`npm install` también funciona, pero no respeta el lockfile y las versiones pueden variar. `npm ci` **no** funciona.

La primera carga en desarrollo tarda unos 7 s mientras Vite optimiza dependencias.

### Variables de entorno

Ninguna es obligatoria en local. Copia [`.env.example`](.env.example) a `.env` (ignorado por git) y ajusta lo recomendado:

```text
BETTER_AUTH_URL=http://localhost:4322
BETTER_AUTH_SECRET=<32 o más caracteres aleatorios>
```

Genera el secreto con `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

> **Importante:** `BETTER_AUTH_URL` debe coincidir exactamente con el origen que usas en el navegador. Por defecto es `http://127.0.0.1:4322`; si abres `localhost:4322` o cambias de puerto sin definirla, las llamadas a `/api/auth/*` responden `403 INVALID_ORIGIN`.

| Variable | Cuándo | Para qué |
|---|---|---|
| `BETTER_AUTH_URL` | Recomendada; obligatoria en Vercel (HTTPS) | Origen base de auth y origen de confianza |
| `BETTER_AUTH_SECRET` | Recomendada; obligatoria en Vercel (≥ 32 caracteres) | Firma de sesión y de accesos a documentos protegidos |
| `DATABASE_URL` | Opcional; obligatoria en Vercel (`libsql://…`) | Por defecto `file:./data/nanobook.db` |
| `DATABASE_AUTH_TOKEN` | Opcional | Token de una base libSQL/Turso remota |
| `RESEND_API_KEY`, `EMAIL_FROM` | Opcional; obligatorias en Vercel | Envío del correo de verificación |
| `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` | Opcionales (ambas o ninguna) | Inicio de sesión con GitHub |
| `GITHUB_TOKEN` | Opcional | Documentos con `ref` a archivos de GitHub |
| `VERCEL`, `VERCEL_DEPLOY` | **No definir en local** | Activan el modo y el adaptador de Vercel |

### Entornos: local y staging

Se usan dos archivos, ambos ignorados por git:

| Archivo | Cómo se usa | Base de datos |
|---|---|---|
| `.env` | `pnpm dev`, `pnpm build`, `database:migrate` | Local (`file:./data/nanobook.db`) |
| `.env.staging` | `pnpm dev:staging`, `database:migrate:staging`, `profile:change-username:staging` | Una base libSQL/Turso **de pruebas** |

`.env.staging` se carga encima de `.env` (lo que no defina se hereda), y las variables ya presentes en el shell ganan sobre ambos. Los scripts de base de datos imprimen el destino (archivo o host remoto, sin credenciales) antes de actuar. La base de producción vive solo en el panel de Vercel, nunca en archivos locales.

Para probar el despliegue real antes de mergear, empuja la rama y usa el *Preview Deployment* de Vercel, con las variables del ámbito *Preview* apuntando a la base de pruebas. Ojo: `pnpm dev:staging` no reproduce el modo Vercel (`VERCEL=1` exige HTTPS).

### Primer uso

1. Abre `http://localhost:4322/login` y regístrate (el registro es un modo de la pantalla de login).
2. **Verifica el correo.** Sin `RESEND_API_KEY`, en `pnpm dev` el enlace de verificación se imprime en la consola del servidor: ábrelo en el navegador. (En `build`/`start` sin Resend el correo no sale y el login responde `403 EMAIL_NOT_VERIFIED`; configura `RESEND_API_KEY` y `EMAIL_FROM`.)
3. Inicia sesión y crea tu primer nanobook desde `/nanobooks`. La base empieza vacía: no hay datos iniciales.

### Build y producción local

```bash
pnpm run build        # usa el adaptador Node salvo que VERCEL=1 o VERCEL_DEPLOY=true
pnpm run start        # http://localhost:4320 (ajusta BETTER_AUTH_URL a ese origen)
```

### Scripts

| Script | Descripción |
|---|---|
| `dev` | Servidor de desarrollo (puerto 4322) |
| `build` | Genera `dist/` |
| `preview` / `dev:preview` | Previsualiza el build (puerto 4320) |
| `start` | Ejecuta `dist/server/entry.mjs` (requiere build) |
| `test` / `test:watch` | Vitest (suite principal + suite de componentes Astro) |
| `dev:staging` | Desarrollo cargando `.env` y encima `.env.staging` (`node --env-file`) |
| `database:migrate` / `database:migrate:staging` | Aplica las migraciones de `drizzle/` a la base de `.env` / `.env.staging` |
| `mcp:stdio` | MCP local por STDIO (mismo servidor que `/mcp`; usa `.env`) |
| `profile:change-username` / `…:staging` | Cambia el username de un perfil (`--email --expected-username --username [--database-url]`) |

### Problemas conocidos al clonar

- **`.env.local` de otros entornos:** si copias uno que defina `VERCEL_DEPLOY=true` o un `DATABASE_URL` remoto, compilarás para Vercel y escribirás en esa base.
- **Windows:** `CLAUDE.md` es un symlink a `AGENTS.md`; sin `core.symlinks` se materializa como archivo de texto. No afecta a la ejecución.

## Arquitectura

El código de `src/` se organiza por **módulo** y, dentro, por **entorno de ejecución** (`browser/`, `server/`, `shared/`). Los módulos de negocio del servidor siguen tres capas: `domain/`, `application/` e infraestructura, con un compositor `index.ts`. `application/` es la raíz de composición global (`getApp()`), y `pages/` solo adapta HTTP y delega en los módulos. Convenciones completas en [AGENTS.md](AGENTS.md).

### Módulos

Cada módulo tiene su propio `README.md` con qué hace, cómo está construido, cómo se usa y sus dependencias.

**Núcleo** (sin ellos no hay producto)

| Módulo | Qué es |
|---|---|
| [shared](src/shared/README.md) | Tipos base, bus de eventos, conexión a BD, guardas HTTP, estilos globales |
| [application](src/application/README.md) | Raíz de composición por entorno (`getApp()`) |
| [authorization](src/authorization/README.md) | Motor único de decisión de acceso (`Authorizer`, `Policy`) |
| [auth](src/auth/README.md) | Identidad y sesión sobre Better Auth, GitHub OAuth, proveedor OAuth/MCP |
| [documents](src/documents/README.md) | Ciclo de vida de documentos, editor y vista previa |
| [nanobooks](src/nanobooks/README.md) | Agregado raíz: la colección que contiene los documentos |
| [rendering](src/rendering/README.md) | Pipeline Markdown → HTML, bloques de componentes y caché de páginas |
| [layouts](src/layouts/README.md) | Layouts y shell visual de Astro |
| [pages](src/pages/README.md) | Rutas y adaptadores HTTP; middleware |

**Capa superior** (funcionalidad adicional sobre el núcleo)

| Módulo | Qué añade |
|---|---|
| [navigation](src/navigation/README.md) | Grafo de documentos, sidebar, breadcrumbs, índices |
| [profiles](src/profiles/README.md) | Perfiles públicos y username |
| [theme](src/theme/README.md) | Temas oficiales y personalizados |
| [agents](src/agents/README.md) | Servidor MCP con OAuth para agentes de IA |

**Opcionales**

| Módulo | Qué añade |
|---|---|
| [financial-content](src/financial-content/README.md) | Bloques financieros en Markdown (6 fences) |
| [spreadsheets](src/spreadsheets/README.md) | Hojas de cálculo editables en Markdown |
| [toast](src/toast/README.md) | Notificaciones efímeras en el navegador |


### Documentación

La documentación vive junto al código: el README de cada módulo describe su estado actual (qué hace, cómo está construido, cómo se usa, dependencias y límites conocidos), y [AGENTS.md](AGENTS.md) recoge las convenciones. El historial está en git y en [CHANGELOG.md](CHANGELOG.md).

## Acceso desde agentes (MCP)

Nanobook expone un servidor MCP remoto en `POST /mcp` con diez herramientas (`list_nanobooks`, `get_nanobook`, `create_nanobook`, `update_nanobook`, `list_documents`, `get_document`, `create_document`, `update_document`, `get_markdown_blocks_guide`, `validate_markdown_blocks`). La conexión usa OAuth 2.1 con PKCE y los scopes `nanobooks:read` y `nanobooks:write`; no comparte cookies con el agente. Detalle en [src/agents](src/agents/README.md).

**En local, por STDIO:** el transporte depende del entorno: desplegado (`VERCEL=1`) sirve HTTP en `/mcp` con OAuth; en local el cliente lanza el mismo servidor por STDIO (`pnpm --silent run mcp:stdio`) con `NANOBOOK_MCP_USER_EMAIL` (correo de un usuario existente en la base). Ejemplo para Claude Code: `claude mcp add nanobook-local --env NANOBOOK_MCP_USER_EMAIL=tu@correo.com -- pnpm --silent --dir <ruta-del-repo> run mcp:stdio`. Detalles y configuración JSON en [src/agents](src/agents/README.md).

## Autenticación con GitHub (opcional)

Crea una GitHub OAuth App con el scope `user:email` y define `GITHUB_OAUTH_CLIENT_ID` y `GITHUB_OAUTH_CLIENT_SECRET` (si solo defines una, la app falla al iniciar). Callback por entorno:

```text
Local:      http://localhost:4322/api/auth/callback/github
Producción: https://<tu-dominio>/api/auth/callback/github
```

## Despliegue

Pensado para Vercel: define `VERCEL_DEPLOY=true` o `VERCEL=1`, `DATABASE_URL` (libSQL/Turso) con `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_URL` (origen HTTPS canónico), `BETTER_AUTH_SECRET`, `RESEND_API_KEY` y `EMAIL_FROM` (con dominio verificado). Aplica las migraciones con `database:migrate` antes de publicar.

## Versionado

[Semantic Versioning](https://semver.org/lang/es/) y [Conventional Commits](https://www.conventionalcommits.org/) (`tipo(alcance): descripción`). Cambios en [CHANGELOG.md](CHANGELOG.md). Antes de commitear o etiquetar, `npm run build` debe pasar.

## Licencia

[GNU Affero General Public License v3.0](LICENSE). El código puede estudiarse, modificarse y redistribuirse; las versiones modificadas ofrecidas como servicio web deben publicar su código fuente bajo la misma licencia y conservar la atribución.
