# Navigation

> Construye y cachea, por nanobook, el grafo de documentos (árbol, dependencias) y lo sirve como `NavigationService` (breadcrumbs, sidebar, hijos, invalidación) más los componentes de sidebar, breadcrumb e índice.

**Nivel:** Capa superior  ·  **Entornos:** server / browser

## Qué hace
- Construye un `DocumentsGraph` por `nanobookId` a partir de `documents.getAllDocuments` (árbol padre/hijo ordenado por `position` y título, más aristas de dependencia).
- Cachea el grafo por nanobook (memoria local o Runtime Cache de Vercel) y lo refresca al recibir `DocumentCreated`, `DocumentUpdated` o `DocumentDeleted`.
- Entrega un `NavigationService` por petición con `getHref`, `getBreadcrumbs`, `getSidebarEntries`, `getParentEntry`, `getImmediateChildren`, `getDocumentIdByPath` y `getInvalidatedIds`.
- Calcula la invalidación en cascada por el grafo (tipos de arista `parent-child`, `sibling-order`, `proxy-target`, `internal-link`).
- Oculta datos descriptivos de documentos protegidos para quien no puede escribir (`restrictSecuredNavigation`).
- Aporta la UI: `SidebarNav`, `Breadcrumb` e `IndexList`/`DocumentIndex`, y el contrato `NavigationContext`.
- NO hace: persistir documentos, decidir acceso (no usa `authorization`), renderizar Markdown ni la tabla de contenidos (el TOC vive en `documents/browser/ui/components/TableOfContents/`).

## Cómo está construido
```text
navigation/
  server/
    index.ts                          # NavigationModule + reexports (NavigationService, restrictSecuredNavigation, tipos)
    domain/types.ts                   # NavigationNode, Crumb, ParentEntry, DocumentsGraph (puerto), NavigationService (contrato), DocumentChange, InvalidationResult, DependencyEdge/Kind, snapshot
    application/
      NavigationService.ts            # vista con opciones { rootPath, basePath }
      NavigationGraphCache.ts         # puerto: getOrCreate / refresh (+ CachedNavigationGraph.toSnapshot)
      restrictSecuredNavigation.ts    # decorador de redacción por espectador
    infraestructure/
      DocumentsGraph.ts               # construye nodos, padres, hijos y aristas; toSnapshot/fromSnapshot
      InMemoryNavigationGraphCache.ts
      VercelNavigationGraphCache.ts   # namespace "nanobook-navigation-graph-v1", TTL 300 s, deduplica con `pending`
      createNavigationGraphCache.ts   # VERCEL === "1" -> Vercel; si no, memoria
  browser/ui/
    NavigationContext.ts              # { section: project|read|edit|new|preview, book?: { name, href } }
    components/Breadcrumb.astro
    components/SidebarNav/            # index, SidebarList, SidebarHeader, SidebarModeToggle, OpenSidebar, CloseSidebar, ToolTip
    components/IndexList/             # index.astro, DocumentIndex.astro
```

- **Domain:** solo tipos. `NavigationNode` separa identidad estable (`id`) de ruta pública mutable (`path`).
- **Application:** `NavigationService` es una vista sin estado sobre un grafo; `getHref` usa `basePath` (`/n/<slug>`) y `rootPath` fija el contexto de breadcrumbs/sidebar. `restrictSecuredNavigation(service)` devuelve otro `NavigationService` que, para nodos con `metadata.secured === true`, conserva título, ruta y marca de bloqueo y vacía `description`, `tags` y `cover`; no modifica el grafo cacheado.
- **Puertos y adaptadores:** `NavigationGraphCache` -> `InMemoryNavigationGraphCache` / `VercelNavigationGraphCache`. El grafo se serializa como snapshot (`nodes` sin `children`, `edges`) y se reconstruye con `DocumentsGraph.fromSnapshot`.
- **Eventos:** consume `DocumentCreated`, `DocumentUpdated`, `DocumentDeleted` (de `documents/server/domain/events`); ignora los que no traen `nanobookId`. No emite.
- **Persistencia/caché:** sin base de datos propia; solo la caché del grafo.
- **Librerías:** `@vercel/functions` (`getCache`).

## Cómo se usa
- Punto de entrada: `server/index.ts`. `Application` hace `NavigationModule.create(nanobookModule.documentModule, eventBus)`; solo necesita `getAllDocuments` (`Pick<DocumentModule, "getAllDocuments">`) y puede recibir una caché distinta como tercer argumento.
- Las páginas obtienen el servicio por petición (ejemplo real de `DocumentPage.astro`):

```ts
const shared = await navigationModule.getNavigation(nanobookId, {
  rootPath: "index",
  basePath: `/n/${nanobook.getSlug()}`,
});
// Quien puede editar ve todo; el resto ve los protegidos redactados.
const navigationService = canEdit ? shared : restrictSecuredNavigation(shared);
```

- `navigationService` se pasa a `Layout`/`LayoutShell`/`Header`, que lo usan para sidebar, breadcrumbs y el índice. `Layout` recibe también `NavigationContext` para el encabezado.
- Consumidores de `getNavigation`: `documents/browser/ui/pages/{DocumentPage,EditPage,NewPage,PreviewPage}.astro`.
- Rutas HTTP propias: ninguna; la navegación se resuelve en SSR dentro de las páginas.

## Dependencias
- **Depende de:** `documents` (`DocumentModule.getAllDocuments`, entidad `Document`, `DocumentMetadata` y eventos de documento); `shared` (`Result`, `EventBus`, `EventBusError`).
- **Lo usan:** `application` (composición), `layouts` (`Layout`, `LayoutShell`, `Header`), `documents/browser/ui/pages` (consumen `getNavigation`) y `theme` (pruebas de estilos de sus componentes).
- Acoplamientos a vigilar: `domain/types.ts`, `DocumentsGraph` y los eventos importan tipos y clases del dominio de `documents` (el módulo depende de la capa de dominio de otro); los componentes `.astro` de `navigation/browser/ui` no deben importar valores de servidor (solo tipos).

## Seguridad y autorización
- No registra políticas ni usa `Authorizer`. La protección es por visibilidad de datos: `restrictSecuredNavigation` redacta descripción, tags y portada de documentos `secured`; quien llama (la página) decide cuándo aplicarla, usando `canEdit`.
- El grafo cacheado es compartido por todos los espectadores: nunca se redacta en la caché, solo en la vista por petición.
- El acceso al nanobook en sí lo decide `NanobookAccessPolicy` (módulo `nanobooks`) antes de llegar a la navegación.

## Pruebas
- Junto al código: `server/application/{NavigationService,NavigationModule,restrictSecuredNavigation}.test.ts`, `server/infraestructure/{DocumentsGraph,VercelNavigationGraphCache}.test.ts`, `browser/ui/components/IndexList/DocumentIndex.test.ts`; además `layouts/components/Header.test.ts` y `theme/browser/ui/styles/themeStyles.test.ts` leen sus componentes.
- Ejecutar: `npx vitest run src/navigation`. Cubren cálculo de invalidación, breadcrumbs y sidebar, refresco por eventos, caché Vercel y redacción de protegidos. Los `.astro` se prueban con `npm run test:astro`.

## Decisiones y límites conocidos
- Pendiente/notas: `NavigationModule.buildGraph` deja un `console.log` de depuración.
