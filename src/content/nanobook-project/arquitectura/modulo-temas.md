---
id: "theme-module-2026-10-15"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Módulo de temas oficiales y personalizados"
description: "Decisión de almacenamiento, resolución y aplicación de temas por nanobook."
date: 2026-10-15
author: "Nanobook"
tags: ["nanobook", "arquitectura", "temas"]
draft: false
---

## Decisión

`src/theme` es el dueño de los temas. El módulo contiene el catálogo de temas
oficiales, el dominio de temas personalizados, la persistencia, la resolución
de valores y las capacidades HTTP y de edición. No conoce documentos,
perfiles, navegación ni autenticación; la aplicación raíz solo compone sus
capacidades y el módulo de nanobooks conserva una referencia de asignación.

Los componentes consumen variables semánticas (`--theme-*`) y atributos
`data-theme`. Así, un componente no necesita conocer si el valor proviene de
un tema oficial o de una personalización. El navegador reaplica el estado
recibido en el documento después de una navegación de `ClientRouter`, retirando
las variables inline del tema anterior antes de instalar las nuevas.

## Almacenamiento y resolución

Un tema guardado contiene identidad, propietario, nombre, tema oficial base y
solo los tokens que el usuario cambió. Los tokens se validan dentro del módulo
y se persisten como JSON en la tabla `themes`; no se guardan fragmentos CSS ni
referencias a componentes.

El nanobook guarda una referencia estricta `{ kind, id }` dentro de
`settingsJson`. La resolución sigue este orden:

1. Una referencia `official` usa el catálogo oficial.
2. Una referencia `custom` carga el tema del propietario y superpone sus tokens
   sobre el tema oficial base.
3. Un tema personalizado ausente, inválido o inaccesible cae al tema oficial
   `classic` completo.
4. Los nanobooks existentes con configuración `{}` conservan `classic`; los
   nuevos se crean con `official:nanobook`.

La composición SSR resuelve el tema efectivo por solicitud y lo entrega al
layout. El layout publica ambas paletas de color y el modo claro/oscuro en el
documento para evitar que la navegación cliente deje valores del nanobook
anterior.

## Límites actuales

La primera versión no incluye borrado, historial de revisiones, recursos de
imagen, marketplace ni CSS arbitrario. Esas capacidades pueden añadirse dentro
del módulo sin cambiar el contrato de tokens ni hacer que los componentes
conozcan la persistencia.
