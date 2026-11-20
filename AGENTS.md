# Convenciones para agentes de código

Guía de ejecución local y visión general en [README.md](README.md). Cada módulo de `src/` tiene su propio `README.md`: es la fuente de verdad sobre qué hace, cómo está construido y cómo se usa.

## Entorno y comandos

- **Gestor de paquetes: pnpm** (`packageManager` en `package.json`; el único lockfile es `pnpm-lock.yaml`). Instalar con `pnpm install --frozen-lockfile`. No usar `npm ci`.
- Node `>= 22.12`.
- `pnpm run dev` (4322) · `pnpm run build` · `pnpm run start` (4320) · `pnpm test` (Vitest + `vitest.astro.config.ts`) · `pnpm run database:migrate`.
- La base local es `./data/nanobook.db` (libSQL/SQLite). Las tablas **no se crean al arrancar**: hay que ejecutar `database:migrate`. `drizzle/` contiene una migración inicial única (`0000_initial`) cuyo `when` en `meta/_journal.json` se fijó al de la última migración histórica, de modo que las bases ya migradas la omiten y las nuevas la ejecutan. Para cambios de esquema, `drizzle-kit generate` crea una migración nueva encima (con fecha posterior); versionarla. El historial anterior está archivado fuera del repo.
- Variables de entorno: copiar `.env.example` a `.env`. Nunca definir `VERCEL` ni `VERCEL_DEPLOY` en local, y no ejecutar `dev` ni scripts de base de datos con un `.env.local` que apunte a una base remota sin saberlo.
- Sin `RESEND_API_KEY`, en `dev` el enlace de verificación de correo se imprime en la consola del servidor (`astro dev logs` si el servidor corre en segundo plano).

## Versionado

El proyecto usa **Semantic Versioning** y **Conventional Commits**.

- Formato de versión: `MAJOR.MINOR.PATCH`. Actualmente estamos en `0.x.x`.
- Mensajes de commit: `tipo(alcance): descripción`.
  - `feat` — nueva funcionalidad.
  - `fix` — corrección de bug.
  - `refactor` — cambio de estructura sin cambiar comportamiento.
  - `docs` — documentación.
  - `style` — cambios visuales.
  - `chore` — tareas de mantenimiento.
- Alcances: el nombre del módulo afectado (`documents`, `nanobooks`, `auth`, `authorization`, `rendering`, `navigation`, `theme`, `profiles`, `agents`, `financial-content`, `spreadsheets`, `toast`, `layouts`, `pages`, `shared`, `application`) o `docs`, `deps`, `build`.

Antes de cualquier commit o tag, ejecutar `pnpm run build` y `pnpm test`, y asegurarse de que pasen.

## Changelog

Mantener `CHANGELOG.md` actualizado. Los cambios sin versión van en `[Unreleased]`. Al releasear, moverlos a una versión numerada con fecha.

## Tags

Crear tags anotados sobre `main`:

```bash
git tag -a v0.x.x -m "Release v0.x.x: descripción corta"
```

## Estructura de módulos

El código fuente en `src/` se organiza primero por módulo y después por entorno de ejecución (`browser/`, `server/`, `shared/`). Cada módulo contiene únicamente los entornos donde tiene presencia. Niveles:

| Nivel | Módulos |
|---|---|
| Núcleo | `shared`, `application`, `authorization`, `auth`, `documents`, `nanobooks`, `rendering`, `layouts`, `pages` |
| Capa superior | `navigation`, `profiles`, `theme`, `agents` |
| Opcional | `financial-content`, `spreadsheets`, `toast` |

```text
src/
  application/      # Composición global (browser/, server/, shared/)
  auth/             # browser/, server/, shared/
  authorization/    # server/
  documents/        # browser/, server/
  nanobooks/        # browser/, server/
  navigation/       # browser/, server/
  profiles/         # browser/, server/
  rendering/        # browser/, server/, shared/
  theme/            # browser/, server/, shared/
  agents/           # server/ (MCP)
  financial-content/# browser/, shared/ (extensión de Markdown)
  spreadsheets/     # browser/, server/, shared/ (extensión de Markdown)
  toast/            # browser/
  layouts/          # Composición visual compartida de Astro
  pages/            # Rutas Astro y adaptadores HTTP
  shared/           # Contratos, utilidades e infraestructura transversales
  middleware.ts     # Guarda de origen y Server-Timing
  env.d.ts          # Tipos globales de Astro
```

Reglas:
- Crear `browser/` o `server/` dentro del módulo solo cuando tenga código para ese entorno; no crear carpetas vacías.
- Los módulos de negocio en `server/` se organizan en tres capas: `domain/`, `application/` e infraestructura (`infrastructure/` o `infraestructure/`, según el módulo), más el compositor `index.ts`. No crear capas vacías. Las pruebas se ubican dentro de la capa que verifican.
- Los tipos y contratos puros no dependen de Astro ni de I/O; los adaptadores concretos contienen los side effects.
- `browser/` reúne presentación y código cliente. Los scripts que se envían al navegador no deben importar valores de servidor que arrastren secretos, I/O o APIs de Node.js.
- `server/` contiene lógica y adaptadores de servidor; no depende de APIs del navegador.
- Los componentes Astro de presentación residen en `browser/ui/` (las páginas, en `browser/ui/pages/`), incluso cuando su frontmatter consulta servicios de servidor: Astro ejecuta ese bloque exclusivamente en SSR. Mantener esas dependencias fuera de los bloques `<script>` cliente. Las rutas en `pages/` delegan en los módulos.
- `application/` en la raíz de `src/` conserva los puntos de composición global por entorno (y, en `shared/`, la composición idéntica para ambos); no es un módulo de negocio sujeto a las tres capas. Los módulos no importan `application`; reciben sus dependencias por props o por composición.
- `rendering` no conoce a otros módulos de negocio (lo verifica `rendering/boundary.test.ts`): recibe documentos por forma estructural, eventos por nombre y bloques por registro. `financial-content` y `spreadsheets` son extensiones que se registran en la composición; los demás módulos no deben depender de ellas.
- `authorization` es un núcleo compartido que decide todo el acceso. Los casos de uso (`application/`) solo lo consumen a través de `Authorizer` y `Subject`. Las políticas que implementan su contrato `Policy` (`NanobookAccessPolicy` en `nanobooks`, `DocumentPasswordPolicy` en `documents`) son adaptadores: viven en `infraestructure/access/` de su módulo y se registran en el compositor `index.ts` con `Authorization.register(...)`; solo los compositores reciben `Authorization`, los casos de uso reciben `Authorizer`. `authorization` no importa módulos de negocio.
- Evitar `core` como cajón de sastre; usar nombres que describan la responsabilidad.

## Documentación

- **Cada módulo mantiene su `README.md`** en la raíz de su carpeta, con la plantilla: propósito y nivel, qué hace, cómo está construido (capas, puertos, adaptadores, eventos), cómo se usa, dependencias, seguridad, pruebas y decisiones/límites conocidos. Al cambiar el comportamiento, la API pública, las dependencias o las rutas de un módulo, actualizar su README en el mismo commit.
- Las decisiones arquitectónicas, bugs importantes y cambios de convenciones se registran en la sección "Decisiones y notas" del README del módulo afectado y en `CHANGELOG.md`. Los cambios transversales se reflejan en este archivo y en el `README.md` raíz.
- Los README describen el **estado actual**; no acumulan historial ni planes obsoletos (el historial vive en git y en el changelog).
