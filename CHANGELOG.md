# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

- Reorganizado el editor de temas en secciones con etiquetas y ayuda contextual, revisión de contraste junto a la paleta, acciones de guardado persistentes y vista previa adaptada al espacio disponible.

- Reemplazados los desplegables de acciones del gestor de nanobooks por acciones visibles; cada formulario aparece en un panel flotante bajo su tarjeta, con botón de cierre, y la selección de tema usa opciones de radio comparables.

- Aplicadas las esquinas suaves y sombras desplazadas a la lectura Markdown y al contenedor principal. Cuaderno también las activa para que sean visibles en nanobooks que ya usan ese tema.

- Establecido Monocromo como tema por defecto de la aplicación, la landing, nuevos nanobooks y nuevos temas personalizados; los temas asignados explícitamente se conservan.

- Añadida vista previa de Monocromo para la landing mediante `/?theme=monocromo`; el acceso normal continúa usando Cuaderno.

- Refinado Monocromo con textura fina de bajo contraste, jerarquía tonal más clara, títulos editoriales y detalles de cubierta de libro usando las opciones de tema existentes.

- Añadido el tema oficial Monocromo; Clásico y Nanobook ahora se presentan como Grafito y Cuaderno, respectivamente. Refinada la paleta clara y oscura de Cuaderno para separar mejor papel, superficies y acento editorial.

- Modernizado el formulario de ingreso con una composición adaptable de dos columnas y una portada editorial de Nanobook, conservando los flujos de registro, autenticación social y acceso al inicio.

- Añadidos los temas oficiales Herbario (tinta verde y textura editorial) y Plano (papel frío, grafito y grilla técnica), disponibles también como bases para temas personalizados.

- Recuperados los fondos graduales y visibles de las listas Markdown anidadas; la navegación cliente vuelve a aplicar el tema al documento activo.

- El contenido renderizado de los documentos Markdown ocupa todo el ancho del panel, incluso con temas que tenían guardada una medida de lectura estrecha.

- Unificadas las tramas del tema como primitivas globales reutilizables con escala y contraste; el editor ya no configura una trama separada para la página. Los temas guardados con `pagePattern` se normalizan a `decoration.pattern` al leerse.
- Renovado el tema oficial Nanobook con una paleta de papel cálido y terracota, títulos serif, superficies limpias y metadatos editoriales; la auditoría conserva los roles de tema existentes y no añade opciones redundantes.
- Modernizado el tema oficial Clásico con una escala neutra de papel y grafito, grilla discreta, estados legibles y superficies técnicas sin tramas ni filas zebra.
- Ampliados los temas con roles de enlace, foco, selección y superficie elevada; el editor advierte sobre contraste insuficiente en ambos modos y previsualiza estados y lectura.
- Añadidos presets de ritmo tipográfico y ancho de lectura, y una escala espacial coordinada por densidad; la prosa mantiene una medida de línea independiente del lienzo.

- Investigados productos y sistemas de diseño con personalización visual y documentadas las prioridades de legibilidad, composición y estados para los próximos tokens de Nanobook.

- Ampliada la personalización de temas con borde sutil, texto sobre acento, colores de estado, fuentes separadas para títulos y código y escala de lectura; el editor previsualiza estos roles y conserva los valores heredados del tema base al guardar.

- Renovadas las tarjetas del IndexList con una zona de cubierta propia, jerarquía tipográfica más clara y distinción entre secciones y documentos; la ruta pública reemplaza el nombre de archivo interno.

- Corregida la llamada HTTP del editor de temas para invocar `fetch` con el contexto global del navegador y evitar `Illegal invocation`.

- Documentado en `src/content/nanobook-project/historial-codex/` el trabajo verificable de Codex en autenticación, perfiles, layout, módulos, documentos, nanobooks, temas y navegación, con referencias y límites de atribución.

- El tema Clásico usa rayas diagonales sutiles como fondo de las tarjetas del IndexList, en ambos modos de color.
- Ajustado el patrón de rayas en las cubiertas: líneas diagonales de 1 px al 6 % de opacidad y capas de sombreado más sutiles.
- Añadido el marcador de bloque `graph` para diagramas de texto con interlineado compacto, preservando saltos y espacios sin alterar el estilo de bloques de código normales.
- Ajustado el contraste de los bloques de código sin lenguaje en ambos modos de color mediante roles semánticos de fondo y texto.
- Completada la adaptación visual al tema en estados de error, controles de formulario, TOC compacto y cubiertas de la landing; colores, radios, tipografía, lomo y elevación ahora usan roles semánticos.
- Alineados los componentes internos del nanobook con la identidad editorial de la landing: cubiertas con lomo, tramas diagonales, marcas de esquina configurables y sombras semánticas. Los temas personalizados ahora pueden controlar por separado la trama de componentes y la del fondo de página; los valores antiguos conservan su comportamiento.
- Separada la textura diagonal sutil (6 % de opacidad) de las rayas diagonales marcadas en los patrones del tema; los temas guardados con `hatch` conservan la textura sutil.
- Corregido el contraste del texto en la acción «Nuevo en esta sección» dentro del contenido de documentos.
- Separada la navegación global de la estructura interna de cada nanobook: el header enlaza a la portada, exploración, espacio de trabajo y cuenta; el breadcrumb y sidebar identifican el libro actual. Las acciones Editar y Nuevo se ubican junto al documento o índice y se muestran según el permiso de escritura.

- Retirado el modo de color `system`: la preferencia admitida queda limitada a `light` y `dark`, las entradas antiguas o inválidas se normalizan a `light` y el botón del header alterna de forma determinista entre ambos modos. También se eliminaron roles CSS sin consumidores del contrato visual.

- Eliminado `createNanobookCapabilities`: navegación y publicación se componen una vez en `Application` y comparten un `InMemoryEventBus` obligatorio con documentos. Los eventos refrescan navegación e invalidan páginas por ID global; las consultas reciben el nanobook explícitamente.
- Añadido el módulo transversal de temas: catálogo oficial, temas personalizados persistidos, editor reutilizable y asignación por nanobook. Cada página SSR resuelve el tema efectivo de su nanobook y la navegación con `ClientRouter` reaplica sus variables semánticas.
- Mejorado el editor de temas personalizados: permite crear y actualizar temas, editar paletas claras y oscuras, elegir tipografía, radio, densidad y decoración, y previsualizar el resultado en ambos modos de color.
- Documentadas las opciones para que `theme` sea propietario del contrato semántico, la compilación CSS y la instalación de estilos.
- Refactorizada la instalación de temas para usar una única hoja `style[data-nanobook-theme]` compilada por `ThemeModule`; se eliminaron los estilos oficiales CSS paralelos y el `style` inline del elemento `html`. La navegación actualiza la misma hoja y navegación, Markdown y decoraciones consumen roles semánticos derivados.

- El cierre de sesión carga la portada pública mediante una navegación completa y una URL nueva, evitando redirecciones antiguas cacheadas para `/` y descartando el estado cliente de la sesión anterior.

- Reubicado el controlador de cierre de sesión y sus pruebas en `profiles/browser`; la operación de autenticación permanece en `auth/browser`.

- Restaurado el enlace del botón «Cerrar sesión» con la operación de autenticación, incluyendo navegación con ClientRouter, bloqueo de clics duplicados y aviso de error con posibilidad de reintento.

- Añadida la landing pública en `/`: presentación del proyecto, accesos de registro e inicio de sesión y catálogo de nanobooks públicos listos para lectura, con diseño adaptable y estados de catálogo vacío o no disponible.
- El acceso principal cambia a «Mis nanobooks» con sesión iniciada; `/login?mode=signup` abre directamente el registro. La landing evita caché compartida y el catálogo solo entrega nombre y slug, sin datos de propietario ni configuración.

- Añadidas edición de nombre, slug y visibilidad y eliminación definitiva desde `/nanobooks`, con autorización de propietario, confirmación por nombre y endpoints `PATCH`/`DELETE /api/nanobooks/:nanobookId`.
- El borrado de nanobooks elimina revisiones, eventos outbox y documentos en una transacción; un fallo revierte toda la operación y no afecta otras colecciones. La edición preserva la versión de contenido y el estado de inicialización.

- Corregido el formulario de creación de nanobooks con `ClientRouter`: el controlador se vuelve a enlazar en cada `astro:page-load`, usa JavaScript válido en el script inline, evita la recarga nativa y muestra errores de red o de API.
- Reubicada la exposición de controladores y capacidades concretas en `NanobookModule`; las rutas ya no importan controladores desde `Application` ni el barrel exporta sus implementaciones.
- Retiradas del barrel de `NanobookModule` las exportaciones públicas de repositorios y del puerto `NanobookRepository`; permanecen privadas dentro de la composición y sus pruebas.
- Corregida la pantalla de listado de nanobooks para invocar `ListNanobooks.execute` después de encapsular el repositorio en capacidades de aplicación.
- Encapsulada la resolución de nanobooks en las capacidades de aplicación `GetNanobookById` y `GetNanobookBySlug`; `NanobookModule` ya no expone el repositorio ni métodos de consulta directos.
- Convertido `DocumentModule` en una capacidad compartida y sin estado de nanobook: sus casos de uso, resolutores y repositorios reciben explícitamente el `nanobookId`; `NanobookModule` compone una sola instancia documental y no conserva asociaciones por colección.
- Integrado en `CreateNanobook` el alta del nanobook con su documento raíz, estado de preparación y reanudación idempotente; se probó con `InMemoryNanobookRepository` y Drizzle persiste el estado mediante la migración `0008_grey_kitty_pryde`.
- Corregida la reutilización de rutas de documentos y carpetas eliminados: la migración `0007_live_document_paths` limita los índices únicos a registros activos (`deleted_at IS NULL`) y conserva el historial del borrado lógico.
- Restaurado el controlador del formulario de nuevos documentos: intercepta el envío para crear mediante la API y redirige al editor dentro del nanobook actual, sin reenviar los campos como parámetros de la URL.
- Restaurada la inclusión de `EditorController` en `DocumentEditor`: el editor vuelve a cargar CodeMirror, inicializar el contenido del documento y conectar los controles de edición.
- Corregidas las rutas generadas por `NavigationModule`: breadcrumbs, sidebar e índices usan la ruta canónica `/n/{nanobookSlug}/...` y dejan de enlazar con las páginas legacy.
- Adelgazado `DrizzleContentRepository`: centralizado el alcance por `nanobookId`, unificado el listado, reutilizada la serialización de metadatos del dominio y eliminado un prechequeo redundante en actualizaciones con revisión.
- Retirados `GitHubRepository` y `FileSystemRepository`, junto con sus adaptadores de escritura/lectura y configuración de fuente; la persistencia activa de documentos queda en SQL por nanobook y `InMemoryRepository` se conserva solo para pruebas.
- Movida la composición de navegación y publicación a `Application.createNanobookCapabilities()`: cada solicitud construye sus capacidades con `nanobookId` explícito y se eliminaron el mapa por tenant, el bus acotado y el ciclo de cierre de `NanobookModule`.
- Simplificado el alta de nanobooks: `CreateNanobook` crea el nanobook, asegura el documento raíz y actualiza `setupStatus`; `Application` ya no coordina pasos entre módulos y un fallo del documento deja el nanobook disponible para un reintento posterior.
- Ajustado el cableado de módulos: `DocumentModule` instancia directamente `DrizzleContentRepository` y sus capacidades desde su propio compositor; cada operación recibe el `nanobookId` explícito y ningún compositor fija ese valor en la instancia.
- Reubicado `RouteProtector` como capacidad server compartida; `Application` la obtiene de autenticación y la inyecta en perfiles, documentos y nanobooks sin exponer el origen de la implementación a esos módulos.
- Reubicada la composición de `NanobookModule` en `src/nanobooks/server/index.ts`, alineándola con el patrón de módulos server que exponen su composición desde `index.ts`.
- La composición server se adelgazó: `Application` coordina autenticación, perfiles y `NanobookModule`, y además crea bajo demanda las capacidades de presentación; `NanobookModule` concentra repositorio, controladores y documentos sin conservar estado por nanobook.
- Eliminado el puente `nanobook_alias`: las rutas canónicas se resuelven por `nanobook.slug` y las rutas legacy responden `410`; la migración de esquema `0006` elimina la tabla.
- Retirado todo el tooling de migración de contenido: producción comienza con una base SQL nueva y el contenido local queda fuera del runtime; se conservan únicamente las migraciones Drizzle de esquema.
- La navegación dejó de interpretar `metadata.nanobook` como frontera implícita; breadcrumbs, sidebar y padre usan únicamente la raíz explícita del contexto del nanobook.
- Vitest usa el pool de threads por defecto para evitar el fallo `EPERM` del pool de procesos al renombrar temporales SSR en Windows.
- El plan y el runbook registran el estado real del preflight local y separan las tareas de código completadas de la ejecución productiva pendiente.
- Producción queda configurada para iniciar directamente con SQL: se retiraron el flag de transición, el webhook de sincronización GitHub, el benchmark comparativo y las rutas mutantes legacy.
- Actualizado el flujo de pruebas y composición del formulario de autenticación para que `auth/browser` tenga un controlador TypeScript ejecutable y testeable.
- Añadidos el benchmark de lecturas SQL/GitHub y el runbook operativo para preparar, verificar, activar y revertir el corte SQL; retirados los comandos de contenido que apuntaban a un script inexistente.
- Corregida la migración para conservar `date`, `createdAt` y `updatedAt` históricos, evitando hashes variables durante la verificación.
- Mejorado el diagnóstico cuando la tabla `nanobook_alias` aún no tiene aplicada su migración; ahora se indica ejecutar `npm run database:migrate`.
- Cerrada la frontera de mutaciones de documentos: los DTO, el editor y el mapper HTTP ya no aceptan ni reenvían `metadata.nanobook`, `ownerId` u otros campos desconocidos; la marca histórica solo se conserva al leer/importar contenido legado.
- Cerrada temporalmente la configuración de nanobooks en un contrato vacío y validado: los manifiestos y la API rechazan proveedores, credenciales y campos arbitrarios hasta que exista una capacidad editorial explícita.
- La creación de nanobooks usa una transacción compartida para insertar la colección, su raíz `index`, la revisión inicial, la versión de contenido y el evento outbox; un fallo al inicializar la raíz revierte toda la operación.
- La API de creación ya no acepta IDs de nanobook enviados por el cliente; la identidad se genera en el servidor.
- Con `NANOBOOK_SQL_CUTOVER=true`, la composición global usa un repositorio de memoria inerte y el webhook de contenido de GitHub responde `410`, evitando acceso accidental al proveedor legacy.
- La API pública de creación tampoco transporta configuraciones del cliente; los settings quedan reservados a manifiestos internos validados por el dominio.
- La persistencia SQL ya no serializa `metadata.nanobook` ni lo usa para calcular versiones; el marcador histórico queda fuera del modelo activo.

- Implementado el primer corte de persistencia SQL para nanobooks y documentos: conexión/migraciones Drizzle compartidas, repositorios acotados por `nanobookId`, revisiones optimistas, outbox transaccional y unidad de trabajo para versionar cambios.
- Añadido `NanobookContext` para aislar repositorio, navegación, eventos y caché por colección. Las rutas canónicas `/n/<slug>/...` validan visibilidad y propietario antes de resolver documentos; las respuestas de edición transportan la revisión esperada y los conflictos devuelven `409`.
- Añadidos el validador de manifiestos y los comandos `content:import-sql`/`content:verify-sql`. La importación parte de un snapshot filesystem, exige clasificar las fronteras históricas y ofrece un informe JSON antes de aplicar cambios.
- Añadida la creación autenticada de nanobooks en `POST /api/nanobooks`, con slug único, visibilidad y configuración inicial persistidas junto al propietario Better Auth.
- Añadidos dispatcher de outbox con reintento seguro, exportación Markdown desde SQL y verificación de asignación de documentos por destino.
- Los cambios del repositorio SQL incrementan `contentVersion` del nanobook, permitiendo invalidar contextos cacheados entre procesos.
- El editor SSR pasa `nanobookId` al writer y selecciona el endpoint `/api/nanobooks/:id/documents/:documentId`, evitando que las mutaciones de una colección terminen en el API heredado.
- Los errores `409` del editor conservan la revisión esperada y actual y muestran un mensaje de conflicto sin descartar el contenido staged local.
- La importación SQL agrupa por destino la creación del nanobook, documentos, revisiones, versión de contenido y outbox en una sola transacción; la verificación compara hashes y detecta documentos inesperados.
- La migración registra alias de las rutas históricas y las rutas legacy pueden redirigir al nanobook canónico conservando autorización.
- Añadido listado autenticado `GET /api/nanobooks` y la pantalla `/nanobooks` para crear y abrir las colecciones gestionadas por la instancia.
- Las mutaciones SQL de documentos registran revisiones y eventos outbox junto con la escritura y actualizan la revisión expuesta al editor.
- Añadido el interruptor reversible `NANOBOOK_SQL_CUTOVER=true`: las rutas legacy sin alias responden `410` y su API mutante queda bloqueado durante el corte.
- El borrado de subárboles SQL se ejecuta en una única transacción, con revisiones y eventos outbox para todos sus documentos.
- El renombrado SQL de directorios y sus descendientes también se aplica en una única transacción, evitando árboles parcialmente movidos.

- Documentada la propuesta y el plan de migración a persistencia SQL compartida para usuarios y documentos: nanobooks independientes con árbol y configuración propios, sin anidamiento; clasificación explícita de fronteras históricas, alias de URLs, aislamiento, revisiones e importación verificable.

- Trasladada la presentación de `auth`, `documents`, `navigation` y `profiles` desde `server/ui` a `browser/ui`, conservando el frontmatter SSR de Astro y actualizando sus consumidores. Los módulos de servidor quedan organizados por dominio, aplicación e infraestructura con `index.ts`; la prueba de composición de navegación reside en su capa de aplicación.

- Reorganizado `src/` por módulo y después por entorno (`<módulo>/browser` y `<módulo>/server`). La composición global reside en `application`, los tipos de Astro en `src/env.d.ts`, y se actualizaron imports, mocks, consumidores y esquemas de Drizzle.

- Las mutaciones de documentos ahora viven bajo `/api/me/documents/:id`; la sesión determina al propietario. Los webhooks administrativos de documentos conservan sus rutas fuera de `/me`.
- Un índice de contenido puede declarar `nanobook: true` para delimitar una navegación contextual: breadcrumbs, sidebar e índice comienzan en ese directorio, sin mostrar sus ancestros externos. La marca solo es válida en documentos índice.
- Añadidos módulos de perfiles separados por entorno: `src/server/profiles` expone dominio, casos de uso, persistencia Drizzle y rutas privadas/públicas; `src/browser/profiles` contiene el cliente HTTP tipado y el formulario de perfil. Los perfiles usan usernames normalizados, únicos e inmutables vinculados a Better Auth.
- Retirado el módulo legado `src/server/users`, sus rutas `/api/users` y su composición en `Application`, sin migrar datos de usuario.
- La aplicación de navegador ahora compone `AuthModule` y `EditionModule` mediante `src/browser/Application.ts` y `getApp()`, eliminando los singletones directos de los consumidores cliente.
- Reorganizado el código fuente por entorno: los módulos de navegador residen bajo `src/browser/`, los de servidor bajo `src/server/`, y las rutas y pruebas consumen las nuevas ubicaciones.
- Añadida una prueba de la ruta comodín de Better Auth para comprobar que expone el controlador compuesto por el módulo de servidor.
- Los documentos ahora conservan `ownerId`, la identidad estable de Better Auth de su propietario. Las altas asignan el actor autenticado en servidor, y actualización, renombramiento y borrado —incluidos subárboles— rechazan con `403` a quien no sea propietario. El contenido existente fue asignado a `carlosmgs111@outlook.com` mediante una migración explícita.
- Las acciones mutantes de la interfaz de documentos (`Nuevo`, `Editar`, `Guardar`, `Eliminar`, `Renombrar` y crear) solo se muestran tras resolver una sesión autenticada; la lectura pública sigue disponible.
- Corregidas las mutaciones de edición para usar `/api/documents/<id>`, evitando que `/api/<id>` sea resuelta por la ruta pública capturadora y asegurando que alcancen el decorador de autenticación.
- La sesión de navegador se conserva durante las navegaciones con `ClientRouter`: las consultas concurrentes a Better Auth se unifican y los flujos de ingreso, registro y cierre actualizan el estado en memoria. El servidor sigue verificando la cookie en cada ruta protegida.
- Reorganizado el entorno de servidor de `auth` bajo `src/auth/server/infrastructure`; su compositor crea un único `authModule` con Better Auth y sus adaptadores. Añadida la capacidad `authModule.protect()` para decorar rutas HTTP, resolver la sesión mediante Better Auth y detener con `401` las solicitudes no autenticadas. Las capacidades HTTP mutantes de documentos (`POST`, `PATCH` y `DELETE`) ya se exponen a través de ese decorador.
- El Header muestra el nombre de la persona autenticada como botón negro hacia `/profile`; `/login` y `/profile` incluyen botones negros para volver al inicio, y el perfil incorpora un cierre de sesión confirmado de forma nativa y respaldado por Better Auth.
- Unificados los inicios de sesión por correo y GitHub bajo la cookie de Better Auth; Header consulta la sesión actual mediante `GET /api/auth/get-session` y ya no se guardan tokens de autenticación en `localStorage`.
- Añadida la ruta `/login` con `AuthForm`, una interfaz única de autenticación que alterna entre ingreso y registro integrada con Better Auth; el enlace global ahora dirige a esta página.
- Añadido `HttpAuthApi` en la frontera de navegador para iniciar sesión y registrar usuarios contra los endpoints de Better Auth.
- Añadido `AuthFormController`, que recibe sus capacidades por constructor y monta la interacción del formulario de autenticación.
- Refactorizada la política de visibilidad por modo como capacidad interna de `AuthFormController`.
- Añadida la capacidad global `Toast`, compuesta por `ToastHost` y `BrowserToastNotifier`, para publicar notificaciones desde cualquier módulo.
- Inyectada la capacidad `ToastNotifier` en `AuthFormController`, con el contrato declarado junto a su implementación de navegador.
- Declarado el markup de cada toast dentro de `ToastHost`, asegurando que sus estilos de Astro se apliquen correctamente.
- Reubicado el esquema de Drizzle de autenticación dentro del módulo `auth` y mantenido el cliente de base de datos como infraestructura compartida.
- Añadido el inicio de sesión con GitHub OAuth, activable con `GITHUB_OAUTH_CLIENT_ID` y `GITHUB_OAUTH_CLIENT_SECRET`, sin sustituir el acceso por correo y contraseña.
- Añadida la verificación de correo con Better Auth y Resend: los registros con contraseña requieren confirmar el enlace enviado antes de crear una sesión; la nueva ruta `/verify-email` guía al usuario mientras espera la confirmación.
- Reorganizados los adaptadores del módulo `user` bajo `infraestructure/inbound/http` y `infraestructure/outbound`, separando transporte HTTP entrante, cliente HTTP saliente y repositorio.
- Añadida la página dedicada `/profile` con formulario accesible, estados de carga/guardado/error, reintento y enlace global `Perfil`; consume `HttpUserApi` y requiere `Astro.locals.currentUserId`.
- Añadido el adaptador de salida `HttpUserApi` para el frontend, con operaciones tipadas de creación, consulta, actualización y eliminación de usuarios, serialización segura y errores HTTP normalizados.
- Añadidos adaptadores de entrada REST para los casos de uso de `user`, con rutas `POST/GET /api/users` y `GET/PATCH/DELETE /api/users/:id`, validación de payloads y mapeo de errores HTTP.
- Añadido el módulo `user` con identidad estable `UserId`, gestión de perfiles, casos de uso CRUD, repositorio en memoria reemplazable e integración con `Application`.
- Separada la auditoría temporal en `createdAt` y `updatedAt`; la identidad, el autor y `createdAt` quedan protegidos durante las actualizaciones, y los payloads de edición ya no aceptan campos controlados por el servidor.
- Ocultos en el editor los campos de identidad y auditoría (`id`, `author`, `createdAt` y `updatedAt`), que además se ignoran si se introducen manualmente en el frontmatter.
- Eliminadas las referencias al atributo temporal legado `date`; el frontmatter y los contratos usan exclusivamente `createdAt` y `updatedAt`.
- El borrado de directorios ahora informa explícitamente las eliminaciones parciales y publica eventos solo para documentos confirmados como eliminados.
- Corregida la sincronización del editor para que `title`, `description`, `position` y `ref` editados en el frontmatter también actualicen los campos del documento staged enviados al backend.
- El repath de directorios ahora mueve también todos sus documentos descendientes en filesystem, GitHub y memoria, conservando sus identidades estables.
- El adaptador filesystem ahora elimina directorios padres vacíos después de un repath, sin borrar carpetas que aún contienen documentos.
- Añadida la acción de renombramiento desde el editor, conservando la identidad estable y redirigiendo a la nueva ruta pública.
- El webhook de GitHub ahora refresca el catálogo remoto y reconstruye la navegación antes de invalidar las páginas afectadas.
- Corregido el borrado de documentos con nombre coincidente con un directorio: solo los documentos índice eliminan descendientes.
- Corregido el adaptador GitHub para borrar usando la ruta correcta e invalidar la caché local y Redis del árbol tras crear o borrar documentos.
- Añadido soporte de repath en las actualizaciones: valida colisiones, mueve el archivo y conserva la identidad estable en filesystem, memoria y GitHub.
- Añadido el borrado de documentos desde el editor, con confirmación explícita y borrado recursivo del contenido de los directorios.
- Corregida la reconstrucción del árbol de navegación después de eliminar documentos o directorios.
- Corregido el uso de HTML cacheado al volver al índice después de una eliminación; las páginas de documentos ahora se sirven con `no-store`.
- `DocumentPath` ahora conserva explícitamente la ruta interna (`new-dir/index`) y expone por separado su ruta pública (`new-dir`), preparando la migración por capas sin cambiar aún el comportamiento de los consumidores existentes.
- `Document` y los repositorios ahora conservan rutas internas de índice (`new-dir/index`); `navigation` y las páginas públicas usan explícitamente la ruta pública derivada, y `UpdateDocument` dejó de reconstruir `/index` desde `metadata.index`.
- `Document.isIndex()` pasa a derivar el tipo de documento desde la ruta interna; creación, navegación, proxies y repositorios ya no usan `metadata.index` como fuente de verdad.
- `DocumentMetadata` y los contratos HTTP ya no exponen `index`; la serialización nueva tampoco lo persiste, y la creación resuelve padres de directorio mediante su ruta interna `/index`.
- Navegación, renderizado, webhook y repositorios usan explícitamente `getPublicValue()` para rutas públicas; el adaptador filesystem dejó de recibir el indicador histórico `isIndex` y ahora deriva el archivo desde la ruta interna.
- Migrados los frontmatters de `src/content` para eliminar `index`; la presencia de `/index` en la ruta interna es ahora la única señal de documento índice, y la documentación arquitectónica fue ajustada a esta regla.
- Corregido `Application.renderPage()` para desenvolver correctamente el `Result` de `DocumentPath.create()` antes de usar la ruta pública.
- Corregida la actualización de documentos índice para conservar la forma canónica de su ruta (`new-dir/index`) durante la validación sin cambiar su ruta pública (`new-dir`) ni su ID estable.
- Corregida la invalidación del webhook de GitHub para resolver rutas públicas a IDs estables y evitar usar rutas como identidad; los documentos nuevos invalidan su padre conocido mientras se incorporan al grafo.
- Renombrado `Entry.parentId` a `parentPath` y los contratos de `listChildren` para distinguir explícitamente ubicación de identidad.
- Cambiada la API de documentos para usar el `id` estable como parámetro dinámico (`/api/<id>`), separándolo del `path` usado por las rutas de navegación y eliminando la dependencia de `/api/documents`.

### Added
- Los flujos de creación y actualización separan el `id` estable del `path`: las operaciones de edición buscan siempre por `id` y reciben la ruta en el cuerpo.
- `DocumentId` queda reservado para identidades estables y opacas; la lógica de rutas, índices y referencias relativas se concentra en `DocumentPath`.
- Navegación, repositorios y resolutores usan explícitamente `path` para localizar documentos y `documentId` para identidad, eventos y dependencias.
- La creación de documentos propaga eventos con la identidad estable del documento creado y de su padre.
- `getByPath()` pasa a ser una operación obligatoria del repositorio; creación, actualización y referencias ya no usan `getById()` como fallback para localizar rutas.
- Las referencias internas separan la ruta de los fragmentos (`#ancla`) y consultas antes de construir dependencias, conservando la navegación con anclas.
- La migración de identidades también reemplaza automáticamente IDs persistidos con prefijo `legacy:` y mantiene los UUID ya existentes.
- El dominio ya no acepta identidades `legacy:<path>`; ese formato queda restringido al script de migración.
- El repositorio GitHub lee el contenido mediante Git Blobs usando el `sha` del árbol, evitando depender del endpoint Contents para repositorios configurados con acceso Git Data.
- La carga pública normaliza la ruta recibida desde la URL antes de consultar el repositorio, incluyendo rutas `.../index` y extensiones `.md`.
- Separación inicial en el dominio de documentos entre identidad estable (`documentId`), ubicación mutable (`path`) y versión del estado (`version`), documentada en `src/content/nanobook-project/arquitectura/identidad-ruta-version-documento.md`.
- Nuevo value object `DocumentPath` para normalizar rutas, detectar índices y resolver referencias sin usar la identidad de la entidad.
- El storage de edición ahora usa claves por `documentId` para staged, preview y confirmed; los renders concurrentes se coordinan por `documentId` y `version`.
- Los repositorios de contenido distinguen `getById()` (identidad estable) de `getByPath()` (ubicación pública), manteniendo compatibilidad temporal para documentos legacy.
- El grafo de navegación y sus aristas (`parent-child`, `sibling-order`, `proxy-target`, `internal-link`) ahora se indexan por `documentId`; los enlaces y breadcrumbs continúan usando `path` para las URLs.
- La caché de páginas publicadas y los eventos de creación/actualización usan la identidad estable del documento.
- Añadido `content:migrate-ids` para asignar y validar identidades persistidas en el frontmatter sin reserializar el contenido.
- La página pública reemplaza su cuerpo por el HTML renderizado por `edition`
  cuando este coincide con la versión confirmada tras guardar, sin consultar el
  backend.
- Documentada la decisión en
  `src/content/nanobook-project/arquitectura/renderizado-local-confirmado-edition.md`.
- `worker-entry2.ts` renderiza las vistas previas de edición con
  `UnifiedMarkdownRenderer` dentro de un Web Worker, preservando el contrato
  `PreviewRenderer` y evitando bloquear el hilo principal.
- Migración del módulo `edition` a arquitectura hexagonal con DDD, replicando el patrón de los demás módulos:
  - `src/edition/domain/`: modelos (`StagedDocument`, `RenderedPreview`), puertos (`DocumentStorage`, `PreviewRenderer`, `PageWarmingService`, `DocumentContentParser`), servicios de dominio puros (`DocumentFlow`, `RenderConfirmation`) y errores tipados (`EditionStorageError`, `EditionRenderError`, `InvalidDocumentContentError`).
  - `src/edition/application/`: casos de uso primitivos (`BuildStagedDocument`, `StageDocument`, `LoadStagedDocument`, `ClearEditionStorage`, `RenderPreview`, `ConfirmRenderedPreview`, `WarmDocumentPage`, `MarkDocumentSaved`) y casos de uso de flujo (`InitializeEditor`, `GetEditorInitialContent`, `SaveDocument`, `HandleEditorChange`, `PrepareEditorNavigation`) con tests unitarios en `src/edition/application/test/`.
  - `src/edition/infraestructure/`: adaptadores concretos (`SessionStorageDocumentStorage`, `WorkerPreviewRenderer`, `FetchPageWarmingService`, `YamlDocumentContentParser`).
  - `src/edition/index.ts`: `EditionModule` como composition root del módulo, exponiendo casos de uso, adaptadores, utilidades de dominio (`isInsideDocumentFlow`), el servicio de flujo `EditorFlow` y el singleton `edition`.

### Added
- Estado de guardado confirmado en el flujo de edición:
  - `src/edition/client/stage-document.ts` expone `markStagedDocumentAsSaved()`, `getStagedDocumentSavedAt()` e `isStagedDocumentSaved()`.
  - `src/edition/client/document-flow.ts`: utilidad compartida `isInsideDocumentFlow()` que incluye la página pública del documento.
  - `src/pages/[...slug]/index.astro` reemplaza el cuerpo renderizado por servidor con la versión guardada en memoria cuando existe un guardado confirmado para el mismo documento, evitando mostrar contenido cacheado antiguo tras editar en producción.
- Indicador visual "Versión guardada en memoria" en el cuerpo del documento cuando se muestra la versión staged.
- Errores de infraestructura tipados por módulo:
  - `src/shared/errors.ts`: `InfrastructureError`.
  - `src/shared/bus/errors.ts`: `EventBusError`.
  - `src/document/infraestructure/errors.ts`: `DocumentRepositoryError`, `DocumentStorageError`, `DocumentParseError`, `DocumentNotificationError`.
  - `src/publishing/infraestructure/errors.ts`: `PageCacheError`, `PageRenderError`.
- `InvalidDocumentError` en `src/document/domain/errors.ts` para errores de construcción de `Document`.
- Tests unitarios para `CreateDocument` y `UpdateDocument` usando `InMemoryRepository` y mocks de `EventBus`/`DocumentChangeNotifier`.

### Changed
- El frontmatter de los documentos usa `ref` para las referencias proxy; se
  migraron los documentos existentes y la plantilla de serialización dejó de
  generar `proxyTargetId`.
- La entidad `Document`, el contrato `Entry` y el grafo de navegación usan
  `ref`/`getReference()` en lugar de `proxyTargetId`/`getProxyTargetId()`.
- El grafo de navegación se reconstruye automáticamente después de eventos
  `DocumentCreated` y `DocumentUpdated`, manteniendo actualizado el sidebar,
  breadcrumbs, relaciones padre/hijo, orden y metadatos sin reiniciar el
  proceso.
- `GitHubRepository` normaliza su configuración en un único objeto, comparte la
  lógica de búsqueda y escritura entre operaciones CRUD y elimina duplicación
  en el acceso a GitHub sin alterar el contrato de `ContentRepository`.
- `GitHubRepository.update()` actualiza la entrada afectada de la caché de
  documentos después de que GitHub confirma el `PUT`, conservando el parser y
  el TTL existente en vez de invalidar todo el catálogo.
- Los eventos de dominio ahora exponen una clave estática tipada y usan
  `documentId`; los buses aceptan la clase del evento al suscribirse y devuelven
  una función de cancelación. `PublishingModule` conserva dichas cancelaciones
  para liberar sus handlers.
- `DocumentEditor.astro`, `PreviewPage.astro` y `src/pages/[...slug]/index.astro` usan directamente `edition` desde `src/edition/index.ts`, eliminando la dependencia de la fachada `src/edition/client/`.
- Helpers de API de documentos (`createDocument`, `updateDocument`) movidos desde `src/edition/client/` a `src/document/client/api/`.
- `code-mirror-editor.ts` movido desde `src/edition/client/` a `src/edition/ui/components/DocumentEditor/code-mirror-editor.ts`.
- `DocumentEditor.astro` delega la orquestación del flujo de edición en casos de uso de alto nivel (`InitializeEditor`, `GetEditorInitialContent`, `SaveDocument`, `HandleEditorChange`, `PrepareEditorNavigation`), eliminando wrappers locales y código redundante.
- `DocumentEditor.astro` marca el borrador como guardado tras un `PATCH` exitoso, vuelve a renderizarlo y ya no borra `sessionStorage` al navegar a la página pública del mismo documento.
- `DocumentEditor.astro` limpia el timestamp de guardado confirmado cuando el usuario escribe cambios no guardados, de modo que la página pública solo muestre la versión en memoria tras un guardado explícito.
- `PreviewPage.astro` usa `isInsideDocumentFlow()` para mantener el borrador al navegar entre `/{id}`, `/{id}/edit` y `/{id}/preview`.
- `RenderPreview` ahora recibe solo el `documentId` y carga el `SerializedEntry` desde `DocumentStorage`, eliminando la necesidad de que los callers construyan o pasen el documento completo; el control del flag de render concurrente se delega a un pipeline interno que devuelve `Result` en todos los caminos.
- `DocumentStorage` se adelgaza: se elimina `getRawDocumentContent`, se fusionan `renderedDocument`/`renderedSource` en un único `CachedPreview`, y el control de render concurrente pasa de `pendingDocument` en storage a un flag en memoria dentro de `RenderPreview`.
- Se elimina el concepto muerto de `savedAt` (`loadSavedAt`, `markSavedAt`, `clearSavedAt`), `EditionState`, `confirmRenderedPreview` e `isInsideDocumentFlow` del módulo `edition`.
- `src/shared/github/api.ts`: `fetchFileContent` ahora usa el endpoint autenticado de contenidos de la API de GitHub cuando se proporciona `GITHUB_TOKEN`, permitiendo leer repositorios privados; sin token sigue usando `raw.githubusercontent.com` para repositorios públicos.
- `Result` en `src/shared/utils/result.ts` ahora expone solo la API estática `Result.ok()` / `Result.fail()`; se eliminaron los helpers comentados `ok()` / `err()`.
- `ContentRepository` devuelve `Result` en todos sus métodos (`list`, `get`, `getBySlug`, `listChildren`, `create`, `update`); las implementaciones `FileSystemRepository`, `GitHubRepository` e `InMemoryRepository` capturan excepciones de infraestructura y las traducen a errores tipados.
- `DocumentChangeNotifier` devuelve `Result<DocumentNotificationError, void>`.
- `EventBus.publish` y `EventHandler.handle` devuelven `Result<EventBusError, void>`; `InMemoryEventBus` combina los resultados de los handlers.
- `RenderedPageCache.invalidate` y `PagePublisher.invalidate` devuelven `Result<PageCacheError, void>`.
- `CreateDocument` y `UpdateDocument` ya no envuelven la lógica en `try/catch` defensivo; reciben `Result` de infraestructura, verifican `isSuccess` y propagan el error.
- Controladores `CreateDocumentController` y `UpdateDocumentController` usan `result.isSuccess` y `result.getValue()`; `handleServiceError` mapea errores de dominio e infraestructura a códigos HTTP.
- `Application.ts` adapta el `DocumentChangeNotifier` para capturar errores de `PagePublisher.invalidate` y devolver `Result`.

### Removed
- Eliminada la fachada `src/edition/client/` y sus tests asociados; la funcionalidad equivalente ahora reside en `src/edition/application/`, `src/edition/domain/` y en los propios componentes Astro.

### Fixed
- La edición de proxies ahora carga el documento fuente y permite modificar
  únicamente su frontmatter; el cuerpo referenciado no se carga ni se puede
  sobrescribir al guardar.
- Los documentos proxy ya no muestran el editor ni cargan el contenido
  referenciado en la ruta de edición; ahora muestran una explicación de solo
  lectura y ocultan el acceso “Editar” desde la vista pública.
- Las páginas proxy conservan el contenido SSR resuelto y ya no son sustituidas
  por previews almacenadas en el navegador durante la carga.
- La página pública ya no reemplaza el contenido SSR de un proxy con una
  preview confirmada de `sessionStorage` cuya referencia `ref` no coincide.
- El editor descarta una copia staged antigua cuando coincide con la última
  versión confirmada y el documento actual ya tiene un `ref` distinto,
  evitando restaurar referencias proxy como `null`.
- Los documentos proxy conservan su campo `ref` después de resolverse, evitando
  que el editor lo pierda y lo vuelva a guardar como `null`.
- Corregido el enlace del header del sidebar: `ParentEntry` ahora conserva la
  identidad estable en `id` y la ruta pública en `path`, evitando generar URLs
  `/undefined/` al navegar hacia índices de carpetas.
- El worker de `edition` resuelve las dependencias de Markdown con la condición
  `worker`, evitando que `remark-parse` cargue un decodificador que requiere
  `document` y bloqueaba el renderizado y guardado en el navegador.
- `DocumentEditor.astro` vuelve a inicializar el editor al navegar desde la vista preview con `ClientRouter`: destruye la instancia de CodeMirror en `astro:before-swap`, busca el contenedor actual en `astro:page-load` y elimina el guarda `if (view) return` que impedía recrear el editor en el nuevo DOM.
- `OnDocumentCreatedHandler` y `OnDocumentUpdatedHandler` importaban `err`/`ok` inexistentes; ahora usan `Result.ok()` / `Result.fail()`.
- `GitHubRepository.create()` ya no oculta cualquier error bajo `DocumentAlreadyExistsError`; distingue errores de dominio de fallos de infraestructura.
- `DocumentStorage` recibe el `documentId` explícito en los métodos `save*`; el
  adaptador `SessionStorageDocumentStorage` ya no reconstruye la clave a partir
  del `id` del documento. `SaveDocument` y `RenderPreview` usan consistentemente
  `documentId`, evitando que la preview quede almacenada bajo una clave
  diferente a la que usa `GetRenderedDocument`.
- `DocumentWriter` ahora devuelve `Result<EditionWriterError, SerializedEntry>`
  en `createDocument` y `updateDocument`; `HttpDocumentWriter` captura errores de
  red y respuestas HTTP fallidas. `SaveDocument` dejó de envolver la llamada en
  `try/catch` y maneja el `Result` devuelto por el writer.

## [0.5.0] - 2026-09-11

### Added
- `ContentRepository` ahora expone `create(document)` y `update(document)` en lugar del ambiguo `save(document)`.
- Errores de dominio para operaciones de escritura: `DocumentAlreadyExistsError`, `DocumentNotFoundError`, `InvalidDocumentIdError` y `ParentNotFoundError`.
- `FileSystemRepository.create()` y `GitHubRepository.create()` para crear documentos nuevos con validación de duplicados.
- `FileSystemRepository.update()` y `GitHubRepository.update()` para actualizar documentos existentes; devuelven error si el documento no existe.
- `POST /api/documents` para crear documentos con validación de ids, padres y conflictos.
- `PATCH /api/[...slug]` ahora actualiza documentos existentes y devuelve 404 cuando no existen.
- `Result<T, E>` con helpers `ok()` y `err()` en `src/shared/utils/result.ts`.
- UI de creación de documentos: formulario `NewDocumentForm.astro` y página `/{slug}/new` con redirección al editor tras crear.
- Botón "Nuevo" en el header para crear documentos desde cualquier página.
- `MemoryRepository` como fuente `memory` en `createContentRepository()` para facilitar tests.
- `src/Application.ts` como **composition root** modular que ensambla `DocumentModule`, `NavigationModule` y `PublishingModule`.
- Casos de uso explícitos en `document/application/`: `CreateDocument`, `UpdateDocument`, `GetDocument`, `GetAllDocuments`.
- `DocumentsGraph` en `src/navigation/infraestructure/DocumentsGraph.ts` con aristas de dependencia (`parent-child`, `sibling-order`, `proxy-target`, `internal-link`).
- `NavigationService` en `src/navigation/application/navigationService.ts` para breadcrumbs, sidebar, padres, hijos e invalidación.
- `PublishingModule` en `src/publishing/index.ts` con ciclo de vida explícito y acceso a `pagePublisher`, `renderedPageCache` e `invalidatePagesController`.
- Webhook de GitHub (`/api/webhook/github`) compuesto desde `Application` e invalidando caché a través del grafo de dependencias.
- Documentación de decisiones en `src/content/nanobook-project/arquitectura/`:
  - `composicion-raiz-modular.md`
  - `refactorizacion-grafo-dependencias.md`
  - `webhook-github-arquitectura.md`
  - `thundering-herd-github.md`

### Changed
- **Refactorización a arquitectura modular con composition root**: las páginas Astro y los endpoints ya no instancian repositorios ni cachés directamente; consumen `getApp()`.
- `src/document/index.ts` ahora exporta `DocumentModule` con `static async create()` en lugar de singletones de módulo.
- `src/publishing/index.ts` ahora exporta `PublishingModule` con `static async create()` en lugar de constantes globales.
- `src/navigation/index.ts` ahora exporta `NavigationModule` con `static async create(documents)`.
- `scripts/push-content-to-github.mjs` ahora migra **todos** los archivos dentro de `src/content/` (no solo `.md`) y crea el tree de GitHub sin `base_tree`, de modo que el repositorio remoto sea un reflejo exacto del contenido local.
- Los handlers de la API de documentos reciben casos de uso por inyección y solo adaptan el patrón `Result` a respuestas HTTP.
- `src/pages/api/[...slug].ts` consume `app.documentModule` a través de `getApp()`.
- `src/pages/api/invalidate.ts` consume `app.publishingModule` a través de `getApp()`.

### Fixed
- `TocNav` ya no usa `define:vars` ni importa `/src/shared/utils/scroll-spy` con ruta absoluta en el cliente.
- Corregida la creación de directorios en `NewPage.astro`: al seleccionar "Directorio" se usaba siempre el id `index` en lugar de `{ruta}/index`, lo que sobreescribía el índice raíz.
- Corregida la normalización de ids en `POST /api/documents`: la API normalizaba el id antes de construir el documento, provocando "Inconsistencia de índice" al crear directorios.
- **`503 Backend.max_conn reached` contra la API de GitHub**: agregado in-flight promise deduplication en `GitHubRepository.list()` y `fetchTree()` para que llamadas concurrentes compartan la misma carga en lugar de disparar múltiples requests simultáneos.

## [0.4.2] - 2026-08-26

### Fixed
- `GitHubRepository` ahora cachea el tree de GitHub en Redis con TTL de 5 minutos, reduciendo las llamadas a la API de GitHub a una cada 5 minutos.
- Aumentado el TTL del cache en memoria de documentos de `GitHubRepository` a 5 minutos.
- Creado helper compartido `src/shared/utils/redis.ts` para conexiones Redis.

## [0.4.1] - 2026-08-26

### Fixed
- `GitHubRepository` ahora descarga archivos Markdown desde `raw.githubusercontent.com` en lugar de la API de GitHub, evitando errores 403 por rate limit en producción.
- Actualizados tests de `GitHubRepository` para reflejar el nuevo formato de respuesta de archivos raw.

## [0.4.0] - 2026-08-26

### Added
- `RedisRenderedPageCache` en `src/rendering/adapters/cache/redis-page-cache.ts` para persistir cuerpos renderizados en cualquier servidor Redis compatible.
- Soporte de `CACHE_BACKEND=redis` en `src/rendering/adapters/cache/factory.ts`.
- `MemoryRepository` en `src/document/adapters/repository/memory-repository.ts` para tests y desarrollo.
- `resolveProxies()` en `src/document/parse/proxy.ts` para resolver referencias `ref` sobre listas de `Document` sin depender de `astro:content`.

### Changed
- **SSR puro**: Astro siempre usa `output: "server"`; eliminado `OUTPUT_MODE` y el modo estático/dinámico.
- `content.config.ts` carga solo archivos locales de `src/content/`; GitHub ya no pasa por Astro Content Collections.
- `createContentRepository()` ahora usa `CONTENT_SOURCE` (`filesystem` default, `github`) y eliminó la opción `astro`.
- Eliminados `AstroCollectionRepository` y `astro-cache.ts`; la carga pasa exclusivamente por `ContentRepository`.
- `ReferenceResolver`, `CompositeReferenceResolver` e `InternalReferenceResolver` trabajan con `Document` en lugar de `CollectionEntry`.
- `FileSystemRepository` y `GitHubRepository` resuelven proxies en `list()`.
- `GitHubRepository` ahora acepta un `pattern` opcional y excluye `README.md` por defecto.
- `GitHubRepository` cachea la lista de documentos en memoria compartida con TTL configurable (default 60s), reduciendo drásticamente las llamadas a la API de GitHub por petición.

### Removed
- Variable de entorno `OUTPUT_MODE` y modos `static`/`dynamic`.
- `src/document/adapters/repository/astro-collection-repository.ts`.
- `src/document/adapters/cache/astro-cache.ts`.
- `toDocument()` basado en `CollectionEntry` de `src/document/parse/document.ts`.

### Fixed
- Eliminados los warnings `Missing required field "title" in document "readme"` al usar `CONTENT_SOURCE=github` con un repo que contiene `README.md` sin frontmatter.
- Reducida la latencia de navegación cuando `CONTENT_SOURCE=github` evitando múltiples fetches del árbol y contenido de GitHub en cada petición.

### Docs
- Actualizada guía de despliegue en Vercel (`despliegue-vercel.md`) para recomendar Upstash Redis en lugar de Vercel KV (deprecado).
- Actualizado `plan-fase-7-isr-modo-dinamico.md` con el backend Redis y variables de entorno.
- Añadida sección de pruebas locales con `vercel dev` y Redis en `despliegue-vercel.md`.
- Actualizado `content-model-architecture.md` para reflejar el modelo SSR puro y `ContentRepository` como única fuente de verdad.
- Actualizado `README.md` con el modelo SSR puro y `CONTENT_SOURCE`.
- Nuevo plan de transición a SSR puro en `src/content/nanobook-project/arquitectura/plan-transicion-ssr-puro.md`.

## [0.3.0] - 2026-08-25

### Fixed
- `resolveReference` en `src/document/core/proxy.ts` resolvía mal las referencias relativas de documentos no índice porque usaba el propio ID como directorio base. Ahora usa el directorio padre para archivos normales y el propio ID para índices, alineado con el campo `index` del frontmatter.
- Editor cargaba siempre el documento staged anterior porque `sessionStorage` usaba una clave global compartida. Ahora el stage se valida por ID de documento y se limpia al salir del flujo edit/preview.

### Added
- Sistema extensible de resolutores de referencias en `src/document/core/reference/`.
- `ref` ahora soporta referencias locales fuera de `src/content/` (`ref: /README.md` o `ref: { source: "local", path: "README.md" }`).
- `ref` ahora soporta referencias a documentos en repositorios de GitHub (`ref: github:owner/repo/path.md` o `ref: { source: "github", owner, repo, path, branch? }`).
- `parseFrontmatter` extraído a `src/document/core/frontmatter.ts` para compartirlo entre loaders y resolutores.
- Vitest como runner de tests con scripts `test` y `test:watch`.
- Suite inicial de tests de contrato para `src/navigation/core/builder.ts` y sus helpers (`getBreadcrumbs`, `getSidebarEntries`, `getImmediateChildren`, `getParentEntry`).

### Docs
- Actualizada la documentación de carga, mapeo y navegación en `src/content/nanobook-project/arquitectura/content-model-architecture.md`, `src/content/nanobook-project/arquitectura/api-de-navegacion.md` y `src/content/nanobook-project/arquitectura/storage-adapters.md`.
- `src/content/nanobook-project/navigation-api.md` ahora enlaza al documento canónico en `arquitectura/api-de-navegacion.md`.
- Nueva sección de documentación del módulo `src/rendering/` en `src/content/nanobook-project/editor/rendering/`.
- Nueva documentación de documentos proxy en `src/content/nanobook-project/arquitectura/proxy-documents.md`.
- Nuevo informe de factibilidad sobre recompilado incremental en `src/content/nanobook-project/arquitectura/informe-factibilidad-recompilado-incremental.md`.
- Nuevo plan de preparación para el grafo de dependencias en `src/content/nanobook-project/arquitectura/plan-preparacion-grafo-dependencias.md`.

### Changed
- `src/navigation/core/builder.ts` ya no filtra borradores; el filtrado es responsabilidad de `ContentRepository`.
- `src/navigation/core/builder.ts` ahora delega la construcción del árbol en `buildDocumentGraph()` de `src/navigation/core/graph.ts`; `NavigationTree` sigue siendo la interfaz pública.
- `src/pages/[...slug]/index.astro` y `src/pages/[...slug]/edit.astro` ahora usan `NavigationService` en lugar de construir `nodeMap` manualmente.
- `DocumentGraph` ahora modela aristas de dependencia: `parent-child`, `sibling-order`, `proxy-target` e `internal-link`, con métodos `getDependencies(id)` y `getDependents(id)`.
- Nuevo extractor de links internos en `src/document/core/link-extractor.ts`.
- Lógica de resolución de referencias relativas extraída a `src/document/core/reference/path-resolver.ts` y reutilizada por `InternalReferenceResolver`.
- Nuevo motor de invalidación en `src/navigation/core/invalidation.ts` con `computeInvalidatedIds()`; soporta scopes `content`, `metadata` y `all` para `DocumentChange`.
- `DocumentGraph` expone `getIncomingEdges(id)` para permitir la propagación de invalidaciones.
- Nuevo `ContentChangeService` en `src/document/core/change-service.ts` que orquesta detección de cambios, grafo de dependencias e invalidación.
- Nuevo `FileSystemRepository` en `src/document/adapters/file-system-repository.ts` para leer contenido sin depender de Astro.
- Nuevo sistema de snapshots con hashes (`src/document/core/snapshot.ts`): `hashDocument()` y `computeDocumentChanges()` detectan `added`, `removed` y `modified` con scope `content`/`metadata`/`all`.
- Nuevo script `pnpm content:changes` (`scripts/detect-content-changes.ts`) que compara contra `.nanobook/content-snapshot.json` e imprime el `ChangeSet` y los documentos invalidados.
- Nuevo `RenderedPageCache` en `src/rendering/core/page-cache.ts` e implementación filesystem en `src/rendering/adapters/file-system-page-cache.ts`.
- Nuevo `PageRenderer` en `src/rendering/core/page-renderer.ts` para renderizar cuerpos de documentos fuera del pipeline de Astro.
- Nuevo script `pnpm content:render` (`scripts/render-invalidated.ts`) que detecta cambios y regenera solo los cuerpos de los documentos invalidados, guardándolos en cache.
- `.nanobook/` añadido a `.gitignore` para excluir snapshots y caches locales.
- Nueva documentación del estado actual del recompilado incremental en `src/content/nanobook-project/arquitectura/recompilado-incremental-estado-actual.md`, incluyendo flujo de principio a fin.
- Unificación de scripts `content:changes` y `content:render` bajo `scripts/content.ts` con subcomandos `status` y `render`; `content:changes` pasa a ser `content:status`.
- Nueva utilidad `shouldRebuildNavigationTree()` en `src/navigation/graph/invalidation.ts` para decidir si un cambio requiere recalcular el árbol de navegación o solo re-renderizar contenido.
- Reorganización estructural de `src/` por dominios: `document/`, `navigation/`, `rendering/`, `edition/` divididos en `model/`, `parse/`, `change/`, `reference/`, `graph/`, `service/`, `page/`, `adapters/`, `client/` y `ui/`.
- Consolidación de persistencia de snapshots en `src/document/change/snapshot.ts`.
- Agrupación de implementaciones de `ContentRepository` en `src/document/adapters/repository/`.
- Agrupación de resolutores de referencias en `src/document/adapters/reference/`.
- Reubicación de utilidades de cliente (`scroll-spy`, `render-service`, workers, CodeMirror) a `shared/client` o `edition/client` según corresponda.

### Fixed
- `src/content/nanobook-project/meta/readme.md` restaurado como proxy a `README.md` de la raíz del proyecto.

## [0.2.0-alpha.1] - 2026-08-22

### Added
- Editor integrado por documento: vista de edición en `/{slug}/edit` usando CodeMirror 6.
- `src/components/DocumentEditor/` con componente Astro y módulo de setup de CodeMirror, diseñado para permitir cambiar de editor en el futuro.
- `src/lib/editor/document.ts` para leer y escribir archivos Markdown de `src/content/`.
- `src/lib/editor/vite-plugin.ts` para exponer endpoints de edición solo en el servidor de desarrollo.
- Botón "Editar" en el header de páginas de documento y botón "Ver" en la vista de edición.
- Prop `hideToc` en `Layout.astro` para ocultar el TOC en la vista de edición.
- `parseDocument(entry)` en `src/lib/document.ts` para extraer headings del contenido sin depender del loader ni de la extensión del archivo.
- Loader `github` en `src/loaders/github/` para cargar contenido Markdown desde un repositorio de GitHub.
- Loader `mixed` en `src/loaders/mixed.ts` para combinar múltiples loaders en una sola colección.
- Script `scripts/push-content-to-github.mjs` para poblar el repositorio `nanobook-content` desde el contenido local.
- Capa de dominio `src/core/` con tipos `Document`, `DocumentMetadata` y `ContentRepository`.
- `AstroCollectionRepository` en `src/core/content/repository.ts` como adapter storage-agnostic para Astro.
- `NavigationBuilder` en `src/core/navigation/builder.ts` con `NavigationTree` cacheado.
- Interfaz `DocumentRenderer` en `src/core/rendering/types.ts` para separar renderizado de almacenamiento.
- Campo `position` en el frontmatter para controlar el orden de documentos en índices y sidebar.
- Documentación de arquitectura en `src/content/nanobook-project/arquitectura/content-model-architecture.md`.
- Documentación de la API de navegación en `src/content/nanobook-project/navigation-api.md`.
- `MemoryRepository` en `src/core/content/adapters/memory-repository.ts` para tests y desarrollo.
- Stub `DatabaseRepository` en `src/core/content/adapters/database-repository.ts` para el futuro adapter de base de datos.
- Documentación de storage adapters en `src/content/nanobook-project/arquitectura/storage-adapters.md`.

### Changed
- Refactor de `DocumentEditor` a una arquitectura componentizada:
  - Extracción de `src/editor/core/stage-document.ts` para gestionar `sessionStorage` del documento en edición.
  - Extracción de `src/editor/core/parse-staged-document.ts` para reconstruir `Document` desde el contenido del editor.
  - Extracción de `src/editor/core/save-document.ts` para centralizar la llamada `PATCH` a `/api/:id`.
  - Nuevos componentes visuales `EditorToolbar.astro` y `EditorStatus.astro` bajo `src/editor/components/`.
  - `DocumentEditor.astro` ahora solo orquesta los módulos anteriores y la instancia de CodeMirror.
- Reubicación de `TableOfContents` e `IndexList` dentro del dominio de documentos:
  - `src/tableOfContents/` → `src/document/components/TableOfContents/`
  - `src/documentIndex/` → `src/document/components/IndexList/`
  - `src/tableOfContents/core/scroll-spy.ts` → `src/document/core/scroll-spy.ts`
- Reorganización de `src/content/nanobook-project/` en subcarpetas temáticas (`general`, `arquitectura`, `layout`, `sidebar`, `table-of-contents`, `versionado`) con índices propios y referencias internas actualizadas.
- Refactor de `src/lib/content.ts`: elimina `getHeadings()` y su dependencia del filesystem.
- `src/pages/[...slug].astro` ahora consume headings a través de `parseDocument(entry)`.

- Loader de GitHub: pre-renderiza el Markdown con `renderMarkdown()` para que `render(entry)` muestre el cuerpo del documento.
- Loader de GitHub: excluye `README.md` del patrón para evitar errores de validación de schema.
- Modo de despliegue configurable mediante `OUTPUT_MODE` (`static` / `dynamic`) en `astro.config.mjs`.
- Adapter de servidor `@astrojs/node` para el modo dinámico.
- `src/content.config.ts` ahora usa solo `glob` en modo estático y solo `github` en modo dinámico; no se mezclan fuentes.

### Fixed
- Renderizado de listas de tareas (checkboxes) al usar `remark`/`unified` añadiendo `remark-gfm` al pipeline.
- TOC no resaltaba la sección visible porque los headings renderizados no tenían `id`; se añadió `rehype-slug` al pipeline.
- Build fallaba al usar `OUTPUT_MODE`: `astro.config.mjs` ahora lee `process.env.OUTPUT_MODE` y las rutas server-only (`preview`, `api`) ajustan `prerender` según el modo.
- Tooltips del sidebar no se mostraban al hacer hover en modo colapsado.
- Loader de GitHub: coerción de fechas ISO a `Date`, soporte para saltos de línea CRLF, generación de IDs alineada con la convención de Astro (`index.md`) y uso de `picomatch` para soportar archivos en la raíz del repositorio.
- Botones de toggle (ancho de contenido, tema, TOC, sidebar) y listeners globales ahora funcionan correctamente tras navegar con `ClientRouter` de Astro; se migraron a scripts tipo módulo bajo `astro:page-load` y se añadieron scripts de restauración de estado en `astro:after-swap`.
- `DocumentEditor` ahora se reinicializa correctamente al volver de la vista preview con `ClientRouter`; se destruye la instancia de CodeMirror en `astro:before-swap` y se vuelve a crear en `astro:page-load` consultando el DOM actual.
- Vista `preview` ahora se renderiza correctamente en cada transición de `ClientRouter` (editor → preview → editor → preview), escuchando `astro:page-load` y manejando el caso de `sessionStorage` vacío.
- `MarkdownItRenderer` ahora usa el motor de regex de JavaScript de Shiki (`createJavaScriptRegexEngine`) en lugar del motor Oniguruma/WASM, evitando errores de carga dinámica de WASM dentro del Web Worker de preview.
- `MarkdownRenderClient` vuelve a usar IDs de petición y un `Map` de promesas pendientes, eliminando la cancelación por terminación del worker que perdía respuestas.
- Nuevo servicio compartido `src/services/render.ts` que coordina el renderizado entre editor y preview: evita duplicados, descarta renders obsoletos y notifica por `BroadcastChannel` cuando el HTML está listo.
- `DocumentEditor` fuerza un render en `astro:before-swap` para que el preview funcione incluso si el usuario navega antes de que termine el debounce de 1 s.
- `preview.astro` ahora inicia el render como respaldo si no hay contenido renderizado, muestra "Generando preview..." mientras espera y se actualiza por `BroadcastChannel` cuando termina cualquier render en curso.

## [0.1.0] - 2026-08-09

### Added
- Layout base con modo de ancho de contenido `constrained` / `full`.
- Header sticky que se adapta al ancho del modo de contenido.
- `SidebarNav` atómico con modo expandido/colapsado, tooltips y toggle.
- `TableOfContents` atómico con scroll spy, indicador visual y modo estándar/compacto.
- `ContentWidthToggle` para alternar entre ancho constrained y full.
- `ThemeToggle` con iconos SVG de sol/luna y brillo en modo oscuro.
- Íconos SVG consistentes con la identidad visual minimalista.
- Scroll vertical en `SidebarNav` con header fijo.
- Estilo global de scrollbar para el proyecto.
- Documentación del proyecto en `src/content/nanobook-project/`.

### Changed
- Migración del layout principal de grid a flex.
- Sidebar declarado con estilos condicionales en componentes hijos mediante `data-sidebar-mode`.
- TOC refactorizado a componentes atómicos basados en IDs y eventos personalizados.
- TOC en modo compacto: fondo con blur, índices más compactos, scrollbar estilizado, animación de despliegue y header sticky con borde inferior.
- Scrollbar de `SidebarNav` oculto para evitar que ocupe espacio en el contenedor.

### Fixed
- Ciclo infinito entre eventos `sidebar:mode` y `toc:mode` en `ContentWidthToggle`.
- Flash inicial del TOC al restaurar el modo guardado desde `localStorage`.
- Truncamiento de ítems largos en la lista del sidebar.
- Comportamiento responsive del header, breadcrumb y TOC en mobile.
- Sidebar en mobile: ahora muestra el texto completo en el drawer, independientemente del modo `collapsed` guardado.

[Unreleased]: https://github.com/usuario/nanobook/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/usuario/nanobook/compare/v0.4.4...v0.5.0
[0.3.0]: https://github.com/usuario/nanobook/compare/v0.2.0-alpha.1...v0.3.0
[0.2.0-alpha.1]: https://github.com/usuario/nanobook/compare/v0.1.0...v0.2.0-alpha.1
[0.1.0]: https://github.com/usuario/nanobook/releases/tag/v0.1.0
