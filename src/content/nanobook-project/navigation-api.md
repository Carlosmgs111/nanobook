---
title: "API de navegación"
description: "Documentación de la API de NavigationBuilder: funciones disponibles, contratos y ejemplos de uso."
date: 2026-08-13
author: "Nanobook Team"
tags: ["arquitectura", "navegación", "api", "navigation-builder"]
draft: false
index: false
---

## Propósito

La navegación de Nanobook se construye a partir del modelo de contenido, no del filesystem. `NavigationBuilder` es el módulo del dominio que transforma una lista de `Document` en estructuras de navegación: árboles, breadcrumbs, sidebars e índices.

El flujo es:

```text
Document[]
    ↓
buildNavigationTree()
    ↓
NavigationTree { roots, nodeMap }
    ↓
getBreadcrumbs() / getSidebarEntries() / getImmediateChildren() / getParentEntry()
```

## Ubicación

```text
src/core/navigation/builder.ts
```

## Tipos

### NavigationNode

Nodo de un árbol de navegación. Es una proyección ligera de `Document`.

```typescript
interface NavigationNode {
  id: string;
  slug: string;
  title: string;
  description: string;
  isIndex: boolean;
  parentId: string | null;
  position: number;
  metadata: DocumentMetadata;
  children: NavigationNode[];
  current?: boolean;
}
```

### Crumb

Elemento de un breadcrumb.

```typescript
interface Crumb {
  id: string;
  title: string;
  href: string;
  current: boolean;
}
```

### NavigationTree

Resultado de construir el árbol. Contiene las raíces y un mapa para consultas directas.

```typescript
interface NavigationTree {
  roots: NavigationNode[];
  nodeMap: Map<string, NavigationNode>;
}
```

## Funciones

### buildNavigationTree

Construye el árbol de navegación completo a partir de todos los documentos.

```typescript
buildNavigationTree(documents: Document[]): NavigationTree
```

- Ordena primero por `position`, luego por título.
- Agrupa los nodos bajo su `parentId`.
- Los documentos sin padre visible aparecen como raíces.
- Excluye documentos marcados como `draft: true`.
- Cachea el resultado por el array de documentos para no reconstruirlo en cada página durante el build.

Devuelve `{ roots, nodeMap }`. `roots` sirve para menús globales; `nodeMap` para resolver breadcrumb, sidebar e hijos en O(1).

### getBreadcrumbs

Devuelve el breadcrumb de un documento dado.

```typescript
getBreadcrumbs(
  nodeMap: Map<string, NavigationNode>,
  entryId: string,
  homeTitle?: string
): Crumb[]
```

- `homeTitle` por defecto es `"Inicio"`.
- Cada segmento del `id` se resuelve contra `nodeMap` para obtener su título.

### getImmediateChildren

Devuelve los nodos hijos directos de una carpeta.

```typescript
getImmediateChildren(
  nodeMap: Map<string, NavigationNode>,
  folderPath: string,
  excludeId?: string
): NavigationNode[]
```

- `folderPath = ""` representa la raíz.
- Respeta la regla de carpetas: una subcarpeta solo aparece si tiene un `index.md` con `index: true` (esto ya está resuelto al construir el árbol).
- `excludeId` permite omitir el documento actual (útil para índices).

### getSidebarEntries

Devuelve los hermanos de un documento dentro de su carpeta padre. Es lo que se muestra en el sidebar.

```typescript
getSidebarEntries(
  nodeMap: Map<string, NavigationNode>,
  entryId: string
): NavigationNode[]
```

- Marca el documento actual con `current: true`.
- Si el documento es la raíz (`index`), devuelve un array vacío.

### getParentEntry

Devuelve el nodo padre de un documento dado.

```typescript
getParentEntry(
  nodeMap: Map<string, NavigationNode>,
  entryId: string
): NavigationNode | null
```

- La raíz (`index`) no tiene padre.
- Los documentos de primer nivel tienen como padre el `index` raíz.

## Ejemplo de uso

```typescript
import { AstroCollectionRepository } from "../core/content/repository";
import {
  buildNavigationTree,
  getBreadcrumbs,
  getSidebarEntries,
  getImmediateChildren,
} from "../core/navigation/builder";

const repository = new AstroCollectionRepository();
const documents = await repository.list();
const { nodeMap } = buildNavigationTree(documents);

const currentId = "nanobook-project/arquitectura/content-model-architecture";
const breadcrumbs = getBreadcrumbs(nodeMap, currentId);
const sidebar = getSidebarEntries(nodeMap, currentId);
const children = getImmediateChildren(nodeMap, "nanobook-project/arquitectura");
```

## Reglas semánticas

- `folder = hierarchy`: la estructura física de carpetas se proyecta en la jerarquía de navegación.
- `index.md` con `index: true` representa una carpeta.
- Los documentos se listan en el índice de su carpeta padre inmediata.
- Los documentos marcados como `draft: true` se excluyen de navegación e índices.

## Relación con otros módulos

- Recibe `Document[]` desde `ContentRepository`.
- Devuelve `NavigationTree`, `NavigationNode[]` y `Crumb[]` a los componentes de UI (`Layout`, `SidebarNav`, `Breadcrumb`, `IndexList`).
- No depende de Astro ni de ningún storage concreto.
