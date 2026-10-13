---
id: "c7ff7f4d-3eba-4587-bdbd-25d8cd68d3e4"
title: "Propuesta: documentos en SQL y múltiples nanobooks"
description: "Diseño propuesto para centralizar la persistencia de documentos y usuarios, conservando identidades y aislando cada nanobook."
createdAt: 2026-10-12T00:00:00.000Z
updatedAt: 2026-10-12T00:00:00.000Z
author: "Nanobook"
tags: [arquitectura, persistencia, migracion]
draft: true
---

# Propuesta: documentos en SQL y múltiples nanobooks

Estado: propuesta de implementación. Este documento no indica que la migración esté ejecutada.

## Objetivo

Una instancia administra usuarios, perfiles, nanobooks y documentos en una misma base SQL. El usuario crea un nanobook y escribe sin configurar proveedores, repositorios ni credenciales. Markdown sigue siendo el formato del cuerpo del documento.

## Decisiones propuestas

- Mantener Drizzle y `@libsql/client`, ya usados por autenticación y perfiles. Primero implementar y verificar en SQLite/libSQL local; habilitar conexión remota compatible por configuración de la instancia. No añadir réplicas locales en la primera entrega.
- Incorporar `nanobooks` como módulo de negocio y entidad explícita. Un nanobook tiene identidad estable, propietario, slug global único, nombre, visibilidad, configuración propia y versión de contenido. Dominio y aplicación no leen variables de entorno.
- Cada documento y directorio pertenece a exactamente un nanobook. Cada nanobook tiene su árbol lógico y raíz `index`; admite directorios de profundidad arbitraria, pero no contiene otros nanobooks. No requiere una carpeta física ni un repositorio independiente.
- La configuración pertenece al nanobook y se valida mediante un contrato tipado; no se hereda desde directorios o nanobooks externos. Los metadatos editoriales de cada documento siguen siendo locales. Reorganizar un directorio dentro del libro no cambia permisos ni configuración efectiva del libro.
- Breadcrumbs, sidebar y navegación parten siempre de la raíz del nanobook de contexto. Retirar la búsqueda de ancestros marcados y `metadata.nanobook` como mecanismo activo de configuración/navegación; rechazar esa propiedad en nuevas mutaciones tras la transición.
- Conservar los IDs globales, autores, propietarios, fechas, cuerpos y frontmatter desconocido. Las rutas pasan a ser relativas a la raíz de destino: toda transformación debe figurar en el manifiesto y las URLs históricas se conservan mediante un mapa explícito de alias a identidades, sujeto a autorización.
- Clasificar cada índice histórico con `nanobook: true` como nanobook independiente o directorio normal mediante manifiesto. Los promovidos salen del árbol de su padre y reciben raíz `index`; los convertidos en directorios pierden la frontera de navegación, de forma explícitamente aceptada. No deducir esta decisión automáticamente.
- Las rutas canónicas son `/n/<nanobookSlug>/...`; los alias antiguos resuelven al documento migrado y aplican sus permisos actuales. Un enlace a otro nanobook es navegación explícita, nunca herencia ni anidamiento.
- Crear un único repositorio SQL acotado por `nanobookId` para cada contexto de ejecución. Ninguna consulta de contenido puede escapar a ese contexto, incluido `getById`.
- Conservar la autorización actual de edición por `DocumentMetadata.ownerId`. El propietario de un nuevo nanobook crea y administra sus documentos. No introducir organizaciones, edición colaborativa ni transferencias automáticas de propiedad durante esta migración. Un documento importado conserva su propietario aunque sea distinto del administrador del nanobook inicial.
- Admitir nanobooks públicos o privados; las nuevas colecciones son privadas por defecto. Para las colecciones importadas, preservar la lectura pública existente mediante selección explícita en el manifiesto. En una colección privada, su propietario administra y lee; un propietario de documento importado mantiene acceso a sus documentos, sin obtener acceso implícito a todo el libro.
- Guardar cambios de documentos, revisiones, incremento de versión de colección y eventos pendientes en la misma transacción. Publicar eventos después del commit; un fallo de entrega no debe aparentar que la escritura se deshizo.
- Implementar revisiones, control optimista de concurrencia y borrado lógico. Git deja de proporcionar historial; la base debe asumir esa responsabilidad.
- La infraestructura de almacenamiento la configura el operador. Los usuarios solo ven configuración editorial y de acceso.

## Fases de entrega

1. Adaptador SQL, entidades independientes y clasificación explícita de la jerarquía histórica, preservando identidades y acceso por URLs anteriores.
2. Contextos aislados, rutas y experiencia de creación de múltiples nanobooks.
3. Corte definitivo, operación, recuperación y retirada de GitHub como almacenamiento principal.

No activar la experiencia multinanobook antes de terminar el aislamiento de API, referencias, navegación, renderizado y almacenamiento de navegador.

## Fuera del alcance inicial

Git Sync, organizaciones/equipos, permisos por grupos, colaboración en tiempo real, búsqueda avanzada, almacenamiento SQL de archivos binarios, réplicas locales y agrupaciones externas tipo bibliotecas. Una futura biblioteca organizaría nanobooks sin anidarlos ni transmitirles configuración. Los adjuntos actuales se inventarían y conservarían; no se eliminará su origen hasta migrarlos o garantizar su disponibilidad.

La transferencia de documentos o directorios entre nanobooks será una capacidad explícita posterior, con permisos en origen/destino, transacción, revisiones, validación de rutas y referencias e invalidación de ambas colecciones. El MVP rechaza cambiar `nanobookId` mediante edición o renombrado normal. La redistribución del importador es una operación de migración controlada y no una API de transferencia disponible al usuario.

## Migración y reversión

Usar una copia consistente del origen (commit SHA si es GitHub) y un manifiesto que clasifique todos los índices marcados, asigne cada documento exactamente una vez y declare cada raíz de destino. Calcular rutas relativas, alias y referencias antes de escribir. Comparar configuración efectiva antigua y propuesta: materializar la configuración propia de cada nuevo nanobook y enumerar pérdidas de overrides al convertir fronteras antiguas en directorios. Bloquear cualquier diferencia no aceptada.

Las referencias internas que crucen las nuevas fronteras no se resolverán automáticamente con permisos más amplios: deben conservarse dentro del mismo libro, materializarse por decisión explícita o convertirse en enlaces autorizados cuando su semántica lo permita. Si no hay una transformación aceptada, se bloquea el corte. Ejecutar simulación, importación idempotente y verificación semántica antes de activar SQL. No usar escrituras dobles. Durante el corte, bloquear mutaciones y detener importadores/webhooks antiguos.

Antes de admitir escrituras SQL se puede regresar al origen congelado. Después de admitirlas, restaurar solo la base anterior perdería cambios: hay que exportar y reconciliar las escrituras nuevas antes de volver al proveedor antiguo. El historial de autenticación y perfiles no debe retroceder al revertir contenido.

## Validación

La entrega requiere aislamiento entre colecciones, rechazo de anidamiento y reasignaciones implícitas, navegación limitada a la raíz explícita, configuración estable frente a movimientos internos, transacciones de subárbol, conflictos de edición con HTTP 409, recuperación de eventos pendientes, IDs preservados y pruebas de lectura privada. Verificar los cambios de rutas, configuración y referencias contra el manifiesto aceptado, conservando el original en el snapshot de migración. Comparar latencia fría y caliente desde el mismo despliegue, sin equiparar caché en memoria con llamadas de red sin caché.
