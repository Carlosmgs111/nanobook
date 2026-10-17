---
title: "Plan de navegación y controles contextuales"
description: "Decisión de diseño y plan de implementación para separar navegación global, navegación de nanobook y acciones del documento."
---

# Plan de navegación y controles contextuales

Fecha: 2026-10-17. Estado: implementado en el árbol de trabajo.

## Objetivo

Una persona debe poder identificar dónde está, volver al proyecto o cambiar de nanobook, y encontrar las acciones del documento junto al objeto que modifican. La lectura pública debe conservar una navegación útil sin mostrar destinos privados.

## Diagnóstico del estado actual

- `src/layouts/components/Header.astro` reúne breadcrumb, Nuevo, Editar, Ver, ancho de contenido, modo de color, perfil, Nanobooks, Temas e ingreso. La prioridad visual y el alcance de cada control quedan mezclados.
- `src/layouts/components/DocumentControls.astro` recibe acciones de página, aunque se renderiza en el encabezado global. El enlace Nuevo puede crear en la raíz desde una página hoja, lo que no expresa su destino.
- `src/navigation/browser/ui/components/SidebarNav/index.astro` y `Breadcrumb.astro` modelan la jerarquía interna del nanobook; no representan el nivel proyecto. En rutas como `/profile`, `/themes` o `/nanobooks`, el breadcrumb interno está vacío.
- `AuthStatusController.ts` muestra las acciones de mutación a cualquier persona autenticada. Las rutas de edición y creación sí verifican permiso de escritura, por lo que la interfaz puede ofrecer una acción que después termina en una denegación.
- La landing usa otro layout. No hay un enlace de marca persistente en el layout interior que permita volver a `/` de forma obvia.

## Criterios de diseño investigados

- Separar navegación global y local según su alcance: la global mantiene destinos estables; la local orienta dentro de la rama actual. [NN/g: navegación local](https://www.nngroup.com/articles/local-navigation/).
- Poner las acciones del contenido junto al encabezado de página, después del título o alineadas con él. [Atlassian Design System: page header](https://atlassian.design/components/page-header).
- Mantener visibles las acciones frecuentes; reservar el desbordamiento para opciones secundarias del mismo objeto. No mezclar acciones globales y contextuales en un único menú. [NN/g: menús contextuales](https://www.nngroup.com/articles/contextual-menus-guidelines/).
- Usar breadcrumbs para ubicación jerárquica, con `nav` etiquetado y `aria-current="page"` en el elemento actual. [W3C WAI: breadcrumb](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/).
- Etiquetar y estructurar los menús de navegación, con estados y acceso por teclado. [W3C WAI: menús](https://www.w3.org/WAI/tutorials/menus/).

Estas referencias respaldan principios generales; la distribución concreta siguiente es una decisión para las rutas y capacidades actuales de Nanobook.

## Alternativas evaluadas

1. **Solo reorganizar el header.** Tiene bajo costo, pero mantiene acciones de documento alejadas de su contenido y no resuelve la separación entre proyecto y nanobook.
2. **Convertir el sidebar del libro en navegación global.** Da acceso a otras secciones, pero mezcla destinos del proyecto con la estructura documental y dificulta la lectura de libros públicos.
3. **Tres ámbitos explícitos (recomendado).** Header compacto para proyecto y cuenta; sidebar para el árbol del libro; encabezado del contenido para acciones contextuales. Conserva la orientación al cambiar de ruta y limita cada control a su objeto.

## Distribución propuesta

| Ámbito | Ubicación | Destinos o controles |
| --- | --- | --- |
| Proyecto | Header compacto persistente | Marca «Nanobook» → `/`; «Explorar» → `/#nanobooks-publicos`; «Mis nanobooks» → `/nanobooks` solo con sesión; «Ingresar» sin sesión. |
| Cuenta | Extremo derecho del header | Activador con nombre o avatar → «Perfil» (`/profile`) y «Cerrar sesión». No ocultar el acceso tras un control sin nombre. |
| Biblioteca de temas | Navegación del espacio de trabajo, visible en `/nanobooks` y en el menú de destinos del proyecto | «Temas» → `/themes`. La asignación de tema a un libro permanece junto a ese libro en `/nanobooks`. |
| Nanobook | Cabecera del sidebar y breadcrumb | Nombre del libro → raíz `/n/{slug}`; árbol lateral para secciones y páginas; breadcrumb para ancestros del documento. Mantener «Explorar» y, para propietarios, «Mis nanobooks» en el header global. |
| Documento en lectura | Fila del título o inmediatamente debajo | «Editar» visible solo al propietario. El contenido y sus metadatos siguen debajo. |
| Índice/directorio | Fila del título del índice | «Nuevo documento» o «Nueva página» con destino explícito «en esta sección». En una página hoja, ofrecer la creación en su carpeta padre desde un enlace contextual con destino nombrado, o limitarla al índice; decidir según la capacidad actual de rutas antes de implementar. |
| Editor | Encabezado del editor y barra de herramientas | «Volver al documento» junto al título; guardar y previsualizar en la barra propia del editor. Evitar «Nuevo» en la edición de otra página. |
| Lectura | Control secundario del header, agrupado como «Vista» si el ancho móvil lo exige | Modo claro/oscuro y ancho de contenido. Son preferencias de visualización, no enlaces a la biblioteca de temas. |

### Boceto de jerarquía

```text
Nanobook  |  Explorar  |  Mis nanobooks / Temas             Vista  Cuenta
-----------------------------------------------------------------------
Manual del usuario > Guías > Instalación             [sidebar del libro]

Instalación                                            [Editar]
Descripción y contenido del documento
```

En móvil: conservar marca, acceso al árbol y cuenta en la primera fila; breadcrumb desplazable o reducido debajo. Las acciones del documento siguen visibles junto al título, con salto de línea si hace falta. Si se usa un menú para destinos globales, nombrarlo «Proyecto» o «Navegación», no «Más».

## Plan de implementación

### Fase 1. Definir el contrato de navegación y permisos visibles

- Crear una representación de contexto de interfaz con página del proyecto, nanobook actual, documento actual y capacidades de lectura/escritura. Resolver los permisos en SSR a partir de la misma identidad y autorización usadas por `resolveNanobookRoute`, sin deducir propiedad solo de la existencia de sesión.
- Propagar ese contexto por `src/layouts/Layout.astro` y `src/layouts/components/LayoutShell.astro`. Definir variantes explícitas para rutas de proyecto, lectura, edición y creación; evitar condiciones basadas en rutas dispersas por componentes.
- Mantener el control de autorización en las rutas y API. El estado visual refleja ese permiso; no lo sustituye.
- Pruebas: visitante en libro público, propietario, usuario autenticado ajeno y rutas privadas. Para cada caso, comprobar visibilidad de acciones y respuesta de la ruta protegida.

### Fase 2. Separar navegación del proyecto y cuenta

- Refactorizar `Header.astro`: marca enlazada a `/`, destinos globales estables, control «Vista» y entrada de cuenta. Extraer componentes de `src/navigation/browser/ui/` para destinos y cuenta si el header deja de ser pequeño.
- Adaptar `AuthStatusController.ts` o sustituir su lógica por estado SSR cuando la ruta ya conoce la sesión. Recalcular estado tras `astro:page-load` sin mostrar enlaces de una sesión anterior durante transiciones.
- Revisar `src/application/browser/ui/LandingPage.astro`, `src/nanobooks/browser/ui/NanobooksPage.astro`, `src/theme/browser/ui/ThemesPage.astro` y `src/profiles/browser/ui/ProfilePage.astro` para mantener nombres y rutas consistentes.
- Pruebas: desde un documento profundo llegar a portada y al listado propio; desde `/nanobooks`, `/themes` y `/profile` se mantiene la navegación global. El menú de cuenta se opera con teclado y cierra al salir o pulsar Escape.

### Fase 3. Acercar las acciones al documento

- Retirar `editHref`, `newHref` y `viewHref` de `Header.astro` y de `DocumentControls.astro`; mover la presentación a `src/documents/browser/ui/components/` y a los encabezados de `DocumentPage.astro`, `EditPage.astro` y `NewPage.astro`.
- Añadir «Editar» a la cabecera de documento en lectura. En índices, mostrar «Nuevo en esta sección». Para hojas, usar el padre real o no mostrar Nuevo; nunca enlazar a una creación en la raíz sin indicarlo.
- Aprovechar `IndexList/index.astro` para que los índices y la raíz tengan el mismo patrón de creación. Mantener `Ver`/«Volver al documento» cerca del título o barra del editor, evitando controles repetidos.
- Pruebas: raíz, índice anidado, hoja, edición y formulario de nueva página; verificar href y destino efectivo de creación en cada caso.

### Fase 4. Mejorar orientación del libro y adaptación móvil

- Añadir el nombre del libro y enlace a su raíz en `SidebarHeader.astro`; conservar debajo el padre o nivel actual. Mantener el árbol del libro en `SidebarList.astro` sin insertar destinos del proyecto entre documentos.
- Revisar `Breadcrumb.astro` para que el nombre del libro sea reconocible en el contexto, sin insertar «Mis nanobooks» en rutas públicas donde el visitante no tiene acceso. Usar `aria-current` únicamente en el destino actual.
- Ajustar `LayoutShell.astro` para que la fila de acciones del documento no compita con el sidebar ni con la tabla de contenidos. En móvil, probar el drawer, el breadcrumb largo y acciones que envuelven línea.
- Pruebas visuales manuales en 320, 375, 768 y 1280 px; teclado, foco visible y cambio entre rutas con `ClientRouter`.

### Fase 5. Cierre y documentación

- Actualizar las pruebas de `src/layouts/components/Header.test.ts` y los contratos de interfaz afectados. Añadir pruebas de comportamiento donde el riesgo sea real, especialmente permisos y rutas de «Nuevo».
- Actualizar `src/content/nanobook-project/editor/creacion-documentos.md` y la documentación de sidebar para retirar referencias al botón Nuevo en el header. Registrar el resultado en `CHANGELOG.md` bajo `[Unreleased]`.
- Ejecutar `npm test` y `npm run build`. Antes de cualquier commit o tag, confirmar explícitamente que `npm run build` pasa. Usar commits Conventional Commits con el alcance correspondiente; no crear tag salvo que se decida publicar una versión.

## Criterios de aceptación

1. En cualquier página interior hay una ruta visible al inicio del proyecto; un visitante de libro público puede volver a explorar otros libros.
2. El breadcrumb y el sidebar indican el libro y la sección actuales sin mezclar destinos de cuenta o del proyecto con documentos.
3. Editar se encuentra junto al título del documento y solo aparece cuando la persona puede editar ese libro.
4. Crear indica el contenedor de destino; desde una hoja no lleva silenciosamente a la raíz.
5. Perfil, Temas y preferencias de lectura son distinguibles por nombre, ubicación y alcance.
6. Las acciones principales son utilizables con teclado y en pantallas pequeñas; los menús exponen nombre y estado accesibles.
7. Las rutas protegidas siguen aplicando autorización en servidor, independientemente de la visibilidad de controles.

## Decisiones pendientes antes de codificar

- Decisión: «Explorar», «Mis nanobooks» y «Temas» son enlaces directos en escritorio y se agrupan bajo «Proyecto» en móvil. La marca siempre enlaza a la portada.
- Decisión: «Nuevo en esta sección» aparece solo en índices. Una hoja no ofrece creación implícita.

## Verificación de la implementación

- `npm test`: 87 archivos y 288 pruebas aprobadas.
- `npm run build`: compilación SSR completada.
- `git diff --check`: sin errores de espacios.
- La validación visual en navegador local quedó pendiente porque el entorno no permitió mantener el servidor de desarrollo ni conectar al puerto local.
