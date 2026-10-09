# Diseño: composición de página declarada por documento

**Fecha:** 2026-10-09  
**Estado:** propuesto  
**Alcance:** frontmatter de documentos, resolución de composición de página, regiones del shell y directorio de nanobooks.

## Objetivo

Nanobook debe permitir que cada documento elija los componentes que ocupan las regiones de su página. La disposición actual, donde `LayoutShell.astro` siempre instancia `Header`, `SidebarNav`, `TableOfContents` y `Footer`, deja de ser una regla estructural y pasa a ser la configuración por defecto.

La configuración se declara en el frontmatter. Los descendientes heredan las regiones que no declaren. Un índice con `nanobook: true` inicia un dominio de composición nuevo: ninguna configuración de su nanobook contenedor puede cruzar ese límite.

El primer componente nuevo, `nanobooks-index`, lista todos los documentos índice cuyo metadato `nanobook` sea `true`. Un índice debe declararlo expresamente para que aparezca; no modifica la navegación contextual interna de cada nanobook.

## Decisiones y límites

- La composición pertenece a cada documento, no al nanobook. `nanobook` solo delimita la herencia.
- El frontmatter identifica componentes de un catálogo cerrado; nunca contiene rutas de archivos ni imports de Astro.
- La primera iteración solo permite reemplazar una región completa. No habrá todavía composición incremental, exclusiones, filtros ni parámetros personalizados para `nanobooks-index`.
- Las regiones son `header`, `leftSide`, `rightSide` y `footer`. El cuerpo del documento sigue siendo una región estructural gestionada por la ruta y `DocumentPage`.
- La edición, creación, serialización y hashing deben conservar el nuevo metadato; las vistas de edición podrán exponer su UI específica en una iteración posterior si no se incorpora en este cambio.

## Contrato de frontmatter

El nuevo metadato se llama `layout`:

```yaml
layout:
  header:
    - id: breadcrumb
  leftSide:
    - id: sidebar-nav
  rightSide:
    - id: nanobooks-index
  footer:
    - id: footer
```

En esta primera iteración, los elementos son objetos `{ id }`, aunque el contrato deja espacio para un futuro campo `options` validado por componente:

```yaml
layout:
  rightSide:
    - id: table-of-contents
      # options: se añadirá en una iteración posterior
```

Los IDs válidos inicialmente son:

| ID | Regiones permitidas | Datos que consume |
| --- | --- | --- |
| `breadcrumb` | `header` | breadcrumbs, enlaces de edición/creación/sesión que hoy alimentan al header |
| `sidebar-nav` | `leftSide` | entradas y padre contextual |
| `table-of-contents` | `rightSide` | headings y el modo de ocultación de edición/preview |
| `nanobooks-index` | `rightSide` | nodos índice con `metadata.nanobook === true` |
| `footer` | `footer` | ninguno |

Se mantienen los nombres estables de IDs aunque el componente Astro que los representa cambie. El catálogo rechaza un ID desconocido o una región no permitida con un error de contenido claro al construir el documento.

## Herencia y política de resolución

Una `PageLayoutPolicy` (o nombre equivalente dentro del dominio de documentos) resuelve la composición efectiva de un documento a partir de su metadato y el grafo de navegación.

La resolución es independiente por región:

1. La región declarada en el documento actual reemplaza la de cualquier ancestro.
2. Una región ausente busca la primera definición al ascender por los padres.
3. Una región declarada como arreglo vacío (`rightSide: []`) es una definición válida: deja dicha región vacía para el documento y sus descendientes, salvo una sobrescritura posterior.
4. La búsqueda se detiene al llegar al índice más cercano con `nanobook: true`; no consulta su padre ni ancestros externos.
5. Si no existe una definición en ese recorrido, se usa el layout base de la aplicación.

El layout base preserva la experiencia actual:

```ts
{
  header: [{ id: "breadcrumb" }],
  leftSide: [{ id: "sidebar-nav" }],
  rightSide: [{ id: "table-of-contents" }],
  footer: [{ id: "footer" }],
}
```

Por tanto, los documentos existentes no cambian visualmente. Un documento índice que desee mostrar el directorio global declara solamente:

```yaml
layout:
  rightSide:
    - id: nanobooks-index
```

## Flujo de datos

```text
Markdown/frontmatter
  → FrontmatterParser
  → DocumentMetadata.layout
  → DocumentsGraph
  → PageLayoutPolicy.resolve(documento)
  → ResolvedPageLayout + PageComponentContext
  → Application.renderPage()
  → Layout / PageShell
  → registro de componentes Astro
```

`Application.renderPage()` seguirá siendo el punto de composición SSR. Además de `breadcrumbs`, `sidebarEntries`, `parentEntry`, `headings` y `childEntries`, obtendrá el `ResolvedPageLayout` y los datos específicos del catálogo. De ese modo, los componentes Astro reciben props ya preparadas y no conocen repositorios, servicios de navegación ni el grafo completo.

`nanobooks-index` se alimentará desde `DocumentsGraph.getAllNodes()`, filtrando nodos índice marcados como nanobook y ordenándolos por el orden consistente ya usado por la navegación. En esta iteración no filtra, pagina ni permite configurar la selección.

## Renderizado

`LayoutShell.astro` pasa de importar e instanciar componentes fijos a dibujar cuatro regiones. Un renderer/adaptador de UI mapea cada componente resuelto a su implementación Astro desde un registro exhaustivo y tipado.

Cada región conserva los contenedores y reglas responsive apropiadas. Una región sin componentes no genera el contenedor lateral correspondiente ni reserva espacio. Una región puede renderizar componentes en el orden declarado. El área principal conserva el `<slot />` que contiene `DocumentPage`.

Los componentes de infraestructura no configurables por documento, como `ToastHost`, los bordes visuales globales, `ClientRouter` y los scripts de restauración, permanecen en el shell; no se convierten en entradas del frontmatter.

## Modelo y validación

Se introducirán tipos puros para `PageRegion`, `PageComponentId`, `PageComponentDeclaration`, `DocumentLayout` y `ResolvedPageLayout`. `DocumentMetadata` incluirá `layout?: DocumentLayout`.

El parser de frontmatter valida la forma del objeto antes de construir el documento. `Document.create` aplica las invariantes que dependan del documento; por ejemplo, `nanobook: true` seguirá siendo válido solo en índices. La política valida la compatibilidad entre componentes y regiones, de forma que el contrato siga protegido incluso si la entrada procede de otro adapter.

El nuevo metadato se incluye en:

- la serialización y el hash de metadatos;
- los DTOs de creación, actualización y respuesta;
- el parser de edición y el escritor HTTP;
- el merge de documentos proxy, con una regla explícita de que el frontmatter del proxy controla el layout de la URL proxy.

## Errores y compatibilidad

- Frontmatter inválido, componente desconocido o componente no permitido en la región: fallo de parseo con ruta, región e ID involucrados.
- Documento sin `layout`: comportamiento idéntico al layout actual mediante el layout base.
- Región válida con `[]`: renderizado correcto sin columna vacía ni margen lateral sobrante.
- Si `nanobooks-index` no encuentra nanobooks, renderiza un estado vacío accesible; el fallo no impide renderizar el documento.

No habrá fallback silencioso para IDs inválidos: ocultar una configuración errónea hace difícil detectar por qué falta navegación.

## Pruebas de aceptación

1. Un documento sin `layout` resuelve exactamente las cuatro regiones del layout base.
2. Un hijo hereda cada región no declarada desde su ancestro más cercano.
3. Una región `[]` elimina la región y se propaga a descendientes hasta ser reemplazada.
4. Una definición local de `rightSide` no altera `header`, `leftSide` ni `footer` heredados.
5. Un índice `nanobook: true` no hereda configuración de su padre; sus hijos sí pueden heredar la suya.
6. Se rechazan IDs desconocidos y componentes ubicados en regiones no permitidas.
7. Un índice que declara `nanobooks-index` recibe todos y solo los índices marcados `nanobook: true`.
8. El shell no instancia `SidebarNav` ni `TableOfContents` cuando las regiones efectivas no los contienen.
9. La creación, actualización y edición preservan `layout`; el cambio invalida las páginas afectadas por hash/metadatos.
10. `npm run build` termina correctamente.

## Evolución posterior

- `options` por componente, con esquemas propios y selección manual de nanobooks.
- Presets de layout como azúcar sintáctico que se expanden al mismo `DocumentLayout` antes de la resolución.
- Composición incremental (`append`/`prepend`) si aparece un caso real; no se incorpora antes para no complicar la semántica de reemplazo.
- Regiones adicionales o variantes de cuerpo, si el contenido demuestra que `main` también requiere composición.
