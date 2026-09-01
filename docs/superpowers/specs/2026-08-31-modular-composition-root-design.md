# Diseño: módulos explícitos, inversión de dependencias y composición raíz

## Propósito

Reorganizar Nanobook sin alterar sus capacidades de publicación, edición ni sincronización. El resultado debe hacer explícita la responsabilidad de cada módulo, impedir que los casos de uso dependan de Astro, Redis, `node:fs` o GitHub, y concentrar la selección de implementaciones en un único borde de la aplicación.

## Decisiones

1. Se conserva la partición de dominios establecida por `AGENTS.md`: `document`, `navigation`, `rendering`, `edition` y `shared`. No se crea una capa `core` ni se traslada `src/pages`, requerido por Astro.
2. Cada dominio usa cuatro nombres con significado: `model` (reglas y contratos puros), `application` (casos de uso), `ports` (dependencias que el dominio necesita) y `adapters` (I/O e integraciones).
3. Los contratos que representen una necesidad del dominio pertenecen al dominio consumidor. Por tanto, la invalidación posterior a una escritura vive como `document/ports/document-view-invalidater.ts`, aunque su implementación borre una caché de renderizado.
4. `src/composition/server.ts` será la única composición raíz de servidor: lee `astro:env/server`, elige repositorio/caché/renderizador y construye los casos de uso. Las rutas Astro son adaptadores de entrada y no construyen infraestructura.
5. Se mantiene `PageRenderer` como coordinador de la vista, pero se inyectan `ContentRepository`, `DocumentRenderer`, `RenderedPageCache` y una consulta de navegación. `renderDocumentPage` deja de instanciar adaptadores.
6. La compatibilidad se preserva mediante fachadas temporales y movimientos con `git mv`. Los imports profundos se sustituyen gradualmente por puntos de entrada de cada dominio, sin introducir un contenedor DI genérico.

## Límites

```text
src/pages + src/layouts + document/ui       adaptadores de entrada/presentación
                    │
                    ▼
document/application, rendering/page, navigation/service
                    │
                    ▼
document/model + document/ports + rendering/model + navigation/model
                    ▲
                    │
document/adapters + rendering/adapters + Astro/GitHub/Redis/filesystem
                    │
                    ▼
src/composition/server.ts
```

Las flechas de compilación apuntan hacia contratos y lógica pura. Solo `composition` conoce ambos lados de cada puerto.

## Reglas de dependencia

- `model`, `parse`, `graph`, `reference` y `ports` no importan Astro, módulos de Node, Redis ni GitHub.
- `application` puede importar modelo, puertos y funciones puras de otros dominios, pero no adaptadores.
- `adapters` implementa puertos; nunca decide mediante variables de entorno qué adaptador utilizar.
- `pages` y `api` obtienen dependencias desde la composición raíz y traducen HTTP/Astro a entradas y salidas de casos de uso.
- `shared` no importa ningún dominio.

## Compatibilidad y riesgos

La refactorización conserva URLs, forma de los payloads, el formato Markdown y las variables de entorno existentes. Se validará cada entrega con pruebas unitarias, `pnpm test`, `pnpm build`, `pnpm content:status` y `pnpm content:render`. En especial, el webhook debe esperar la creación de caché antes de invalidar y los adaptadores Redis deben cerrar o reutilizar correctamente su cliente según el ciclo de vida del runtime.

## Fuera de alcance

No cambiaremos el modelo de contenido, los endpoints públicos, el proveedor GitHub, el formato de caché ni el comportamiento visual. No se incorporará una librería de inyección de dependencias.
