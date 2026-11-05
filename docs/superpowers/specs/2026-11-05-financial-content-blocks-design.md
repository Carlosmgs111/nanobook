---
title: "Bloques financieros componibles para notas de Companio"
description: "Diseño del módulo financial-content y su integración con el renderizado y los temas de nanobook."
createdAt: 2026-11-05T00:00:00.000Z
updatedAt: 2026-11-05T00:00:00.000Z
author: "Nanobook"
tags: [arquitectura, contenido-financiero, renderizado, companio]
draft: true
---

# Bloques financieros componibles para notas de Companio

## Estado

Diseño aprobado. La implementación avanza de forma incremental: primero el
renderizado compartido y después los bloques financieros según sus planes.

## Intención

Companio podrá producir notas de estudio que combinen razonamiento escrito con
evidencia financiera verificable. Nanobook conservará Markdown como fuente de
verdad y añadirá bloques especializados que el autor podrá insertar, omitir y
ordenar según la pregunta analizada.

La primera entrega debe permitir una nota real formada por:

- síntesis y explicación en Markdown normal;
- ficha básica de una empresa;
- gráfico de una serie temporal;
- conjunto de métricas citadas;
- noticias relacionadas con resúmenes y enlaces;
- fuentes públicas con periodo y fecha de consulta.

Los mockups elaborados durante la ideación son una referencia de jerarquía y
densidad. No fijan colores, estructura obligatoria ni una plantilla de nota.

## Objetivos

1. Mantener notas legibles, versionables y transportables como Markdown.
2. Permitir que Companio genere bloques financieros de forma determinista.
3. Obtener el mismo resultado semántico en la vista previa y en publicación.
4. Aplicar la identidad visual del nanobook mediante el contrato de `theme`.
5. Conservar trazabilidad entre cada afirmación visual y sus fuentes.
6. Admitir datos incompletos sin ejecutar código ni HTML proporcionado por el
   contenido.
7. Dejar una extensión clara para nuevas visualizaciones e integraciones de
   datos sin convertir la primera entrega en un runtime de plugins.

## No objetivos de la primera entrega

- Crear un editor visual por bloques.
- Ejecutar JSX, MDX, JavaScript o HTML arbitrario desde una nota.
- Consultar Companio, bolsas, proveedores financieros o sitios de noticias al
  abrir una página.
- Mantener precios en tiempo real, streaming o actualizaciones automáticas.
- Implementar indicadores técnicos, velas, comparación de carteras o un
  screener completo.
- Diseñar un marketplace o API pública de plugins.
- Reemplazar los componentes estructurales del layout de nanobook.
- Reproducir exactamente la interfaz de Companio dentro de nanobook.

## Antiobjetivos

El diseño se considerará fallido aunque funcione técnicamente si:

- obliga a todas las notas a seguir una plantilla fija;
- incorpora colores o estilos de Companio dentro de los componentes;
- produce resultados distintos entre editor y documento publicado;
- oculta la fuente, el periodo o la vigencia de un dato;
- requiere acceso a red para leer una nota ya publicada;
- permite que el contenido ejecute código o introduzca HTML sin sanitizar;
- crea un módulo genérico `components` que termine reuniendo responsabilidades
  no relacionadas.

## Restricciones existentes

- El proyecto usa Astro SSR, Unified/Remark/Rehype y Markdown como fuente.
- La publicación entrega actualmente una cadena HTML que `DocumentPage.astro`
  inserta mediante `set:html`.
- La vista previa se renderiza en un Web Worker con una implementación separada
  de la publicación.
- El tema efectivo se resuelve en servidor y los componentes consumen roles CSS
  semánticos del contrato de `theme`.
- No deben llegar dependencias de Node.js, secretos ni adaptadores de servidor
  al bundle del navegador.
- La organización del código es primero por módulo y luego por entorno.

## Decisiones tomadas para esta propuesta

Estas decisiones son llamadas de diseño de Codex y quedan abiertas a revisión:

1. El módulo se llamará `financial-content`, no `components`.
2. La primera entrega usará datos incrustados en el Markdown. Companio generará
   el contenido estructurado; nanobook lo validará y presentará.
3. Los bloques se declararán como fences con YAML. Este formato sobrevive como
   código legible en renderizadores que no conozcan la extensión y es sencillo
   de producir tanto por una persona como por un agente.
4. La primera entrega tendrá un catálogo cerrado de cinco tipos.
5. Cada bloque será autosuficiente e incluirá sus propias fuentes. Las series,
   métricas y noticias las referencian por ID dentro del mismo bloque; no habrá
   referencias implícitas a un registro oculto del documento.
6. El resultado inicial será HTML semántico y SVG estático con una hoja de
   presentación propia. La interactividad cliente será una mejora progresiva,
   no un requisito para comprender la nota.
7. No se intentará montar componentes Astro dinámicamente desde `set:html`.
   `financial-content` entregará renderizadores deterministas de bloques; una
   futura salida estructurada podrá habilitar islas Astro cuando exista un caso
   interactivo que lo justifique.
8. `financial-content` será una extensión opcional del renderizador, no una
   dependencia interna de `rendering`. La primera entrega la habilita desde las
   raíces de aplicación, pero el pipeline funciona también sin ella.

## Experiencia de autoría

Los bloques pueden aparecer en cualquier orden y entre párrafos normales. No se
requiere que una nota use todos los tipos.

Ejemplo abreviado de gráfico:

````markdown
```financial-chart
title: ROCE de Alphabet
description: Evolución anual del retorno sobre capital empleado.
chart: line
x: [2020, 2021, 2022, 2023, 2024, 2025]
series:
  - name: ROCE
    unit: percent
    values: [16.7, 28.2, 25.3, 27.3, 33.0, 30.2]
    sourceIds: [alphabet-10k-2025]
sources:
  - id: alphabet-10k-2025
    label: Alphabet 10-K 2025
    organization: Alphabet Inc.
    url: https://abc.xyz/investor/
    type: filing
    period:
      label: FY 2025
      to: 2025-12-31
```
````

Ejemplo abreviado de noticias:

````markdown
```financial-news
title: Noticias relacionadas
items:
  - title: Alphabet eleva su inversión en centros de datos
    summary: La compañía elevó su previsión de CAPEX para infraestructura de IA.
    sourceId: reuters-capex-2026
sources:
  - id: reuters-capex-2026
    label: Alphabet eleva su inversión en centros de datos
    organization: Reuters
    url: https://www.reuters.com/example
    type: news
    publishedAt: 2026-10-29
```
````

El fence completo se reemplaza por el bloque visual. Un fence con tipo
desconocido conserva el comportamiento normal de código. Un fence financiero
con YAML o datos inválidos produce un bloque de error accesible y no ejecuta ni
inyecta el contenido recibido.

## Catálogo inicial

### `company-profile`

Presenta identidad y contexto público de la empresa:

- nombre, ticker, bolsa y país;
- industria y descripción breve;
- moneda de reporte;
- fecha de corte;
- enlaces públicos opcionales;
- fuentes.

No incluye precio en tiempo real ni imágenes remotas en esta entrega.

### `financial-chart`

Presenta una o más series compatibles:

- tipos iniciales `line` y `bar`;
- etiquetas del eje X explícitas;
- valores numéricos finitos;
- unidad `number`, `percent`, `currency` o `multiple`;
- moneda obligatoria cuando la unidad sea `currency`;
- título, descripción, periodo y fuentes;
- tabla accesible equivalente al SVG.

No mezcla unidades incompatibles en el mismo eje. Para compararlas, el autor
usa bloques separados.

### `financial-metrics`

Presenta un conjunto pequeño de métricas:

- etiqueta, valor numérico, formato y periodo;
- comparación opcional y dirección semántica;
- descripción opcional;
- fuente y fecha de corte.

La dirección positiva o negativa no se infiere únicamente por el signo: el
contenido puede declarar si una variación es favorable, desfavorable o neutra.

### `financial-news`

Presenta enlaces a información pública relacionada:

- título y resumen vinculados a una fuente local;
- medio, fecha de publicación y URL tomados de esa fuente;
- empresa o tickers relacionados opcionales;
- métricas mencionadas opcionales como texto;
- indicador explícito cuando el enlace lleva fuera de nanobook.

Nanobook no descarga ni reproduce el artículo. Muestra el resumen suministrado
por Companio y enlaza la fuente pública.

### `financial-sources`

Permite una bibliografía visible cuando la nota necesita reunir referencias:

- etiqueta, organización, URL;
- fecha de publicación o periodo cubierto;
- fecha de consulta;
- tipo de fuente: `filing`, `earnings`, `news`, `dataset` u `other`.

No es obligatorio si cada bloque ya muestra sus fuentes, y no reemplaza las
referencias locales necesarias para interpretar un gráfico.

## Modelo compartido

`financial-content` define un discriminated union puro:

```ts
type FinancialBlock =
  | CompanyProfileBlock
  | FinancialChartBlock
  | FinancialMetricsBlock
  | FinancialNewsBlock
  | FinancialSourcesBlock;
```

Cada bloque contiene:

```ts
interface FinancialBlockBase {
  kind: string;
  version: 1;
  title?: string;
  description?: string;
}

interface CitedFinancialBlock extends FinancialBlockBase {
  sources: FinancialSource[];
}
```

El campo `version` no necesita aparecer en el fence inicial; el parser asigna
`1`. Se conserva en el modelo para evolucionar contratos sin interpretar datos
antiguos con reglas nuevas.

Los esquemas validan límites de tamaño además de tipos. La primera entrega fija
valores conservadores: máximo 8 series, 120 puntos por serie, 12 métricas, 12
noticias y 30 fuentes por bloque. Estos límites protegen el Worker, el SSR y la
legibilidad; quedan como constantes del módulo y no como reglas de negocio de
`documents`.

## Contrato público canónico v1

Este contrato es la interfaz persistida en Markdown. Los nombres no se cambian
sin incrementar la versión del bloque y definir una migración o compatibilidad
explícita.

Las cadenas tienen espacios recortados y límites definidos por el esquema. Las
fechas son siempre fechas civiles ISO `YYYY-MM-DD`, nunca timestamps. Las URL
son absolutas y usan `https:`.

```ts
type ISODate = string;
type HttpsUrl = string;
type SourceId = string;
type CurrencyCode = string; // ISO 4217, tres letras mayúsculas

type FinancialSourceType =
  | "filing"
  | "earnings"
  | "news"
  | "dataset"
  | "other";

interface FinancialPeriod {
  label: string;
  from?: ISODate;
  to?: ISODate;
}

interface FinancialSource {
  id: SourceId;
  label: string;
  organization?: string;
  url: HttpsUrl;
  type: FinancialSourceType;
  publishedAt?: ISODate;
  period?: FinancialPeriod;
  accessedAt?: ISODate;
}
```

Cada fuente requiere `publishedAt` o `period`; puede tener ambos. `id` usa
letras ASCII minúsculas, números y guiones, y es único dentro del bloque.

### `company-profile` v1

```ts
interface CompanyProfileBlock extends CitedFinancialBlock {
  kind: "company-profile";
  version: 1;
  company: {
    name: string;
    ticker: string;
    exchange: string;
    country: string;
    industry: string;
    description: string;
    reportingCurrency: CurrencyCode;
    asOf: ISODate;
    links?: Array<{
      label: string;
      url: HttpsUrl;
    }>;
    sourceIds: SourceId[];
  };
}
```

Todos los campos de `company` salvo `links` son obligatorios. `sourceIds` no
puede estar vacío y respalda la ficha completa.

### `financial-chart` v1

```ts
type FinancialUnit = "number" | "percent" | "currency" | "multiple";

interface FinancialChartBlock extends CitedFinancialBlock {
  kind: "financial-chart";
  version: 1;
  chart: "line" | "bar";
  x: string[];
  series: Array<{
    name: string;
    unit: FinancialUnit;
    currency?: CurrencyCode;
    precision?: 0 | 1 | 2 | 3 | 4;
    values: Array<number | null>;
    sourceIds: SourceId[];
  }>;
}
```

`title`, `chart`, `x`, `series` y `sources` son obligatorios. Cada serie tiene
la misma cantidad de valores que `x`, contiene al menos un número y declara al
menos una fuente. `currency` es obligatorio solo para `currency`. Todas las
series de un bloque comparten unidad y moneda; las comparaciones incompatibles
usan bloques separados. `null` representa un dato ausente explícito.

### `financial-metrics` v1

```ts
interface FinancialMetricsBlock extends CitedFinancialBlock {
  kind: "financial-metrics";
  version: 1;
  metrics: Array<{
    label: string;
    value: number;
    unit: FinancialUnit;
    currency?: CurrencyCode;
    precision?: 0 | 1 | 2 | 3 | 4;
    period: FinancialPeriod;
    description?: string;
    comparison?: {
      label: string;
      value: number;
      direction: "favorable" | "unfavorable" | "neutral";
    };
    sourceIds: SourceId[];
  }>;
}
```

`metrics` contiene entre 1 y 12 elementos. `label`, `value`, `unit`, `period` y
`sourceIds` son obligatorios. La comparación usa la misma unidad y moneda que
la métrica. La dirección siempre es explícita y no se deduce del signo.

### `financial-news` v1

```ts
interface FinancialNewsBlock extends CitedFinancialBlock {
  kind: "financial-news";
  version: 1;
  items: Array<{
    title: string;
    summary: string;
    sourceId: SourceId;
    relatedTickers?: string[];
    mentionedMetrics?: string[];
  }>;
}
```

`items` contiene entre 1 y 12 noticias. Título, resumen y `sourceId` son
obligatorios. La fuente referenciada debe tener tipo `news`; su organización,
URL y fecha alimentan la presentación del medio.

### `financial-sources` v1

```ts
interface FinancialSourcesBlock extends FinancialBlockBase {
  kind: "financial-sources";
  version: 1;
  items: FinancialSource[];
}
```

`items` contiene entre 1 y 30 fuentes y funciona como bibliografía visible. No
autoriza que otros bloques omitan sus fuentes locales ni crea referencias entre
bloques.

### Campos comunes y versión

`kind` se obtiene del nombre del fence y no se repite dentro del YAML. `version`
es opcional en la entrada: si falta, el parser asigna `1`; si aparece, debe ser
exactamente `1`. `title` es obligatorio para `financial-chart` y opcional en
los otros tipos. `description` es opcional en todos.

## Trazabilidad obligatoria

Toda cifra o afirmación estructurada se relaciona con una fuente del mismo
bloque:

- `company-profile.company.sourceIds` respalda la ficha;
- cada serie de `financial-chart` declara `sourceIds`;
- cada métrica declara `sourceIds`;
- cada noticia declara un `sourceId` de tipo `news`;
- `financial-sources` presenta directamente las fuentes.

Las referencias inexistentes, duplicadas o de tipo incompatible invalidan el
bloque. El bloque visual muestra las fuentes próximas al dato y no solo en una
bibliografía al final de la nota.

## Datos incompletos y unidad de fallo

- Un campo opcional ausente se omite sin reservar espacio visual.
- Un campo obligatorio ausente o inválido reemplaza el fence completo por un
  bloque de error; nunca se descartan silenciosamente miembros de una colección.
- Los gráficos aceptan `null` como dato ausente. Una línea se interrumpe en el
  hueco, una barra se omite y la tabla accesible muestra `Sin dato`.
- Una serie formada solo por `null` es inválida.
- Métricas y noticias no admiten elementos parciales: cada elemento debe
  cumplir su contrato.
- El fallo de un bloque no impide renderizar los bloques posteriores.

## Formato determinista v1

La primera versión tiene locale fijo `es-CO`; no se expone todavía una opción
por documento o bloque. El servidor y el Worker usan las mismas funciones puras
de formato:

- `percent`: el valor está expresado en puntos porcentuales; `16.7` se muestra
  como `16,7 %`, no como `1.670 %`;
- `currency`: el valor está en unidades mayores y se muestra con el código ISO,
  por ejemplo `USD 288,93`, evitando símbolos ambiguos;
- `multiple`: `17.8` se muestra como `17,8×`;
- `number`: separadores de `es-CO` y la precisión declarada;
- `precision` predetermina a 1 para porcentaje y múltiplo, y a 2 para moneda y
  número;
- las fechas ISO se formatean como fechas civiles sin convertir zona horaria;
- los cálculos de escalas usan los números originales, nunca texto formateado.

Para evitar diferencias de ICU entre runtimes, las funciones compartidas
normalizan signos, separadores, precisión y fechas; los snapshots no dependen
de la zona horaria del host.

## Fronteras de módulos

```text
src/
  financial-content/
    shared/
      model/                 # Tipos y validación puros
      parsing/               # YAML -> FinancialBlock
      rendering/             # FinancialBlock -> HTML/SVG semántico
      index.ts               # Superficie pública compartida
    browser/
      ui/
        styles/              # Estilos que consumen --theme-*

  rendering/
    shared/
      MarkdownExtension.ts   # Contrato y manifiesto de extensiones confiables
      createMarkdownPipeline.ts
      rendererFingerprint.ts

  publishing/server/         # Adapta el pipeline a SSR y caché
  documents/browser/         # Adapta el mismo pipeline al Worker
  application/
    server/                  # Compone publicación + financial-content
    browser/                 # Compone preview + financial-content
```

No se crean carpetas vacías. `financial-content/server` aparecerá únicamente
cuando exista una capacidad de servidor propia, como resolver referencias o
consultar una fuente externa.

### `financial-content`

Es dueño de:

- los IDs y contratos de los bloques financieros;
- parseo y validación de sus payloads;
- transformación determinista a HTML y SVG;
- presentación, accesibilidad y estilos de los bloques;
- errores específicos y límites de complejidad.

No es dueño de:

- la conversión general de Markdown;
- el almacenamiento de documentos;
- la publicación ni su caché;
- la selección de temas;
- la autenticación;
- la obtención de datos de Companio en esta entrega.

### `rendering`

Es un módulo técnico compartido y browser-compatible. Es dueño de una única
configuración de Markdown y del puerto `MarkdownExtension`. Recibe extensiones
ya compuestas y no importa módulos de negocio concretos. Un renderer construido
sin extensiones conserva Markdown estándar; uno construido con
`financial-content` reconoce sus cinco fences.

Una extensión puede reconocer un nodo, validarlo y devolver HTML semántico. No
puede efectuar I/O, leer secretos ni ejecutar código del documento.

El contrato estable incluye un manifiesto mínimo:

```ts
interface MarkdownExtension {
  readonly id: string;
  readonly version: string;
  readonly fenceLanguages: readonly string[];
  transform(tree: Root): void;
}
```

`id` identifica la capacidad, `version` cambia cuando su parseo o salida cambia
y `fenceLanguages` permite que un futuro resolver detecte qué extensión
confiable necesita una fuente antes de cargar su implementación.

### `publishing`

Conserva publicación, invalidación y caché. Adapta el pipeline compartido al
contrato `DocumentRenderer`. El compositor de servidor le entrega las
extensiones habilitadas.

### `documents/browser`

Conserva la sesión de edición y el puerto `PreviewRenderer`. El Worker usa el
mismo pipeline y las mismas extensiones que publicación. No mantiene una copia
independiente de los esquemas financieros.

### `theme`

Sigue siendo dueño de paleta, tipografía, radios, densidad, superficies,
estados y decoración. `financial-content` consume roles semánticos existentes.
Solo se amplía el contrato si aparece una decisión visual reutilizable que no
pueda expresarse con los roles actuales.

La incorporación visual sigue este orden:

1. inventariar tokens semánticos existentes y construir los bloques con ellos;
2. derivar estados con `color-mix` cuando el rol ya expresa la intención;
3. crear un token nuevo únicamente si representa una decisión semántica
   reutilizable y no un color o detalle propio de un gráfico;
4. si se crea, añadirlo conjuntamente a `ThemeTokens`, presets oficiales,
   resolución clara/oscura, contrato CSS, editor/previsualización y pruebas.

Los tokens nuevos pertenecen siempre a `theme`; `financial-content` solo los
consume. Ejes, series y marcadores usan roles del tema o variaciones derivadas,
no una paleta privada del módulo.

No habrá colores literales de Companio en los componentes. Los estados de
subida, bajada, advertencia e información usan los roles semánticos del tema y
no dependen exclusivamente del color.

## Flujo de renderizado

```text
Markdown + fences financieros
  -> pipeline Unified compartido
  -> extensión de financial-content
  -> parseo YAML seguro
  -> validación a FinancialBlock
  -> HTML/SVG semántico escapado
  -> publicación SSR o vista previa Worker
  -> estilos del módulo usando variables de theme
```

El resultado no depende de JavaScript para mostrar títulos, cifras, leyendas,
fuentes ni la tabla equivalente de un gráfico. Un host del navegador podrá
añadirse en el futuro para tooltips, selección de series o expansión, siempre
como mejora progresiva y solo cuando exista comportamiento cliente real.

## Composición

En servidor, `application/server` crea la extensión financiera y la entrega a
`PublishingModule.create`. En navegador, `application/browser` configura la
misma extensión para el adaptador del Worker. Los módulos no acceden a los
repositorios ni a las implementaciones internas de otros módulos.

El Worker no recibe funciones por `postMessage`. Su entrypoint importa una
factoría de composición browser-safe preparada desde la raíz de aplicación.
El protocolo del Worker continúa enviando únicamente contenido y HTML/error.

## Extensiones opcionales y evolución bajo demanda

La primera entrega implementa opt-in por composición: servidor y navegador
registran explícitamente `createFinancialContentExtension()`. Quitar ese registro
deja el núcleo operativo y los fences financieros vuelven a presentarse como
código portable, sin romper el resto del documento.

No se implementa aún configuración por nanobook, descargas de terceros ni carga
de código remoto. La frontera deja preparado un paso posterior:

```text
catálogo confiable de manifiestos
  -> política de extensiones habilitadas por nanobook/documento
  -> detección de fenceLanguages presentes
  -> carga de la factoría local autorizada
  -> mismo conjunto y versiones en SSR y Worker
```

El contenido podrá solicitar una capacidad por su sintaxis, pero nunca declarar
rutas de importación, paquetes o URL. La aplicación decide qué IDs están
instalados y autorizados. La selección futura deberá formar parte del contexto
de render y producir el mismo conjunto de extensiones en publicación y preview.

## Estilos y layout

- Los bloques ocupan el ancho disponible del cuerpo del documento.
- Párrafos, títulos y explicaciones mantienen la medida de lectura del tema.
- Gráficos y tablas pueden usar el ancho completo del `document-body`.
- Los bloques se adaptan a pantallas estrechas mediante scroll de tabla,
  leyendas apiladas y SVG responsive.
- Tipografía, espacios, bordes, radios y superficies provienen del contrato de
  tema.
- Un bloque nunca cambia el tema ni instala variables globales.

Los estilos viven junto a la UI de `financial-content` y `global.css` los
incorpora una sola vez para documento y preview. No se crea un host Astro vacío
y no se agregan selectores financieros a `shared/styles/prose.css` salvo reglas
realmente genéricas.

## Accesibilidad

- Cada bloque usa un elemento semántico (`figure`, `section`, `dl`, `table`).
- Los gráficos SVG incluyen título y descripción, pero no son la única forma de
  acceder a los valores.
- Todo gráfico ofrece una tabla de datos visible mediante un control o
  disponible para tecnologías de asistencia desde el HTML inicial.
- Tendencias usan texto o iconografía además de color.
- Los enlaces externos identifican su destino y usan atributos seguros.
- Los errores de bloque tienen encabezado, ubicación y explicación legible.
- Se respeta `prefers-reduced-motion`; la primera entrega no necesita animación.

## Seguridad y privacidad

- Solo se interpretan los cinco fences conocidos.
- YAML se convierte a objetos sin constructores ni tags personalizados.
- Todo texto se escapa antes de generar HTML.
- Las URL solo aceptan `https:`; no se permiten `javascript:`, `data:` ni rutas
  de archivo.
- No se permite HTML, CSS, SVG o JavaScript arbitrario dentro del payload.
- Los SVG se construyen desde primitivas conocidas y valores numéricos
  validados.
- Ningún bloque realiza `fetch` durante SSR o en el navegador.
- Los resúmenes de noticias se consideran texto proporcionado por Companio, no
  instrucciones confiables.
- Los datos privados no deben incorporarse en una nota pública. Esta entrega no
  introduce controles de redacción adicionales a la visibilidad existente del
  documento.

## Errores

Un fence financiero inválido se convierte en un bloque de error seguro:

- identifica el tipo de bloque y la posición aproximada;
- explica el campo inválido sin imprimir el payload completo;
- no impide renderizar el resto de la nota;
- produce el mismo resultado en preview y publicación;
- queda cubierto por pruebas para evitar HTML parcial o inyección.

Los tipos de fence desconocidos siguen siendo bloques de código normales. Esto
permite que otros lenguajes y futuras extensiones coexistan.

## Caché y versionado

El HTML publicado depende del contenido, de la versión del núcleo y del orden de
las extensiones activas. La clave lógica será:

```text
documentId + contentHash + rendererFingerprint
```

`rendererFingerprint` concatena la versión del núcleo y los pares `id@version`
de las extensiones en el orden de registro. La versión del núcleo cambia cuando
se modifica Markdown general; la de `financial-content` cambia cuando varía un
schema o el HTML/SVG generado. Así no se comparte caché entre renderizados con
extensiones ausentes, diferentes, reordenadas o actualizadas.

Los datos están incrustados, por lo que una actualización de cifras o noticias
es una actualización normal del documento y usa la invalidación existente.

## Integración con Companio

En la primera entrega, el límite de integración es el contenido Markdown:

1. Companio sintetiza el estudio y prepara datos estructurados.
2. Companio genera Markdown con los fences financieros necesarios.
3. Nanobook valida, previsualiza, guarda y publica la nota.
4. Los enlaces conservan la relación con información pública y noticias.

No se define todavía transporte entre productos, autenticación compartida ni
sincronización. Esas capacidades requerirán un diseño separado cuando se elija
si la integración será API, MCP, exportación de archivos o una combinación.

## Alternativas descartadas

### MDX o componentes Astro importados por el documento

Ofrecen flexibilidad, pero permiten una superficie de ejecución demasiado
amplia, dificultan la generación segura desde Companio y no funcionan en el
Worker actual sin otra cadena de compilación.

### JSON o YAML en frontmatter para toda la nota

Centraliza datos, pero separa la evidencia del párrafo que explica su sentido y
convierte la composición en una plantilla rígida.

### Consultas en vivo desde cada componente

Reducen duplicación de datos, pero introducen latencia, credenciales,
disponibilidad externa y resultados diferentes entre lectura, preview y caché.

### Runtime dinámico de plugins de terceros

No existe todavía una necesidad de terceros que justifique descarga remota,
permisos, compatibilidad ni aislamiento de código. Se conserva el contrato de
extensión y el catálogo confiable futuro, pero la primera entrega registra solo
módulos locales incluidos en la aplicación.

### Salida estructurada con islas Astro desde el primer día

Sería útil para interacción compleja, pero obliga a reemplazar la cadena HTML y
a construir dos presentadores para SSR y Worker. Se pospone hasta que una
capacidad interactiva concreta no pueda resolverse con mejora progresiva.

## Entregas incrementales

### 1. Núcleo de renderizado compartido

- extraer la configuración Unified común;
- incorporar el fingerprint del núcleo y extensiones a la caché;
- demostrar paridad con Markdown existente antes de añadir bloques.

### 2. Modelo y parser financiero

- contratos y validación;
- reconocimiento de fences;
- errores seguros;
- pruebas de límites y URLs.

### 3. Primera nota vertical

- implementar los cinco bloques;
- estilos basados en `theme`;
- HTML/SVG accesible;
- fixture de una nota de Alphabet con datos explícitamente demostrativos.

### 4. Integración editorial

- preview en Worker;
- publicación SSR y caché;
- documentación de autoría;
- decisión arquitectónica en `src/content/nanobook-project/`;
- actualización de `CHANGELOG.md` bajo `[Unreleased]`.

No se incorpora ningún dato demostrativo como dato financiero vigente ni se
presenta como recomendación de inversión.

## Estrategia de pruebas

### Unidad

- cada esquema acepta el caso mínimo y rechaza campos, límites y URLs inválidos;
- números no finitos, series desalineadas y unidades incompatibles fallan;
- escaping impide inyección en títulos, resúmenes, etiquetas y fuentes;
- renderizado SVG y tablas son deterministas;
- los tipos desconocidos conservan su fence.

### Contrato

- una matriz de fixtures produce exactamente el mismo HTML normalizado en el
  adaptador de servidor y el Worker;
- el pipeline conserva GFM, IDs de encabezados y resaltado actuales;
- el fingerprint de núcleo y extensiones cambia la identidad de caché.

### Componentes

- los bloques consumen variables `--theme-*` y no colores literales;
- claro y oscuro mantienen contraste y estados distinguibles;
- tablas, enlaces y errores tienen semántica accesible;
- tamaños estrechos no pierden datos ni acciones.

### Integración

- una nota mixta se ve igual en preview y publicación;
- una nota sin bloques financieros no cambia;
- una edición invalida el HTML cacheado;
- un bloque inválido no rompe los bloques siguientes;
- `npm run test` y `npm run build` pasan antes de cualquier commit o tag.

## Criterios de aceptación

1. Una nota puede combinar libremente Markdown y cualquiera de los cinco
   bloques sin declarar un layout especial.
2. La misma fuente produce contenido financiero equivalente en preview y SSR.
3. Los bloques son legibles sin JavaScript y aplican el tema efectivo.
4. Todo gráfico expone sus datos y fuentes de forma accesible.
5. Un payload inválido nunca ejecuta ni inyecta HTML y genera un error útil.
6. Ningún bloque realiza llamadas de red durante la lectura.
7. Documentos existentes sin fences mantienen su salida.
8. La caché distingue versiones del renderizador.
9. La documentación explica sintaxis, límites y significado de los datos.
10. La decisión arquitectónica y `[Unreleased]` quedan actualizados.

## Decisiones que quedan al constructor

- nombres exactos de clases CSS internas;
- librería concreta de validación si respeta el bundle del Worker;
- algoritmo SVG de escalas, ticks y truncamiento;
- orden interno de archivos dentro de las carpetas descritas;
- texto final de errores, siempre que conserve seguridad y accesibilidad;
- valores finales de espaciado derivados de tokens existentes.

## Aspectos a reconsiderar al crecer

- referencias reutilizables a datasets grandes en lugar de datos incrustados;
- actualizaciones programadas y procedencia firmada;
- comparaciones multiempresa e indicadores técnicos;
- interacción cliente y salida estructurada para islas Astro;
- un registro de extensiones más general si aparecen módulos no financieros;
- transporte y autorización entre Companio y nanobook;
- internacionalización de formatos, monedas y terminología financiera.
