---
title: "Módulo de temas visuales reutilizables"
description: "Diseño incremental para temas oficiales y personalizaciones guardadas por usuario."
createdAt: 2026-10-15T00:00:00.000Z
updatedAt: 2026-10-15T00:00:00.000Z
author: "Nanobook"
tags: [arquitectura, temas, personalizacion]
draft: true
---

# Módulo de temas visuales reutilizables

## Objetivo

Nanobook ofrecerá un tema oficial inspirado en la landing y conservará el
aspecto actual como tema `classic`. Un usuario autenticado podrá partir de un
tema oficial, modificar un conjunto acotado de decisiones visuales, guardar el
resultado y aplicarlo posteriormente a uno o varios nanobooks.

Los componentes seguirán siendo responsables de su estructura y comportamiento.
La identidad visual llegará por propiedades CSS semánticas resueltas antes de
renderizar la página.

## Límites del módulo

`theme` será dueño de:

- el catálogo de temas oficiales;
- la validación y persistencia de temas personalizados;
- la resolución de un tema oficial o personalizado;
- la traducción de valores validados a propiedades CSS;
- las capacidades HTTP y de aplicación para crear, listar y editar temas del
  usuario;
- la presentación y el controlador del editor de temas.

El módulo no importará código de `auth`, `nanobooks`, `documents`, `profiles`,
`navigation` ni `publishing`. Podrá depender únicamente de utilidades e
infraestructura transversal de `shared`. La raíz `application/server` compondrá
los flujos que involucren más de un módulo.

`nanobooks` seguirá siendo dueño de la configuración de cada nanobook. Guardará
una referencia opaca y validada al tema seleccionado, pero no leerá tablas ni
reglas internas de `theme`. La raíz de aplicación verificará que el tema pueda
ser usado por el propietario antes de pedir a `nanobooks` que guarde la
referencia.

## Implementación incremental

La primera entrega empieza por la capacidad técnica de aplicar un tema oficial
en SSR. El contrato visual se extraerá de variables que ya usa el proyecto y se
ampliará solamente al encontrar una decisión visual que deba variar entre
temas. El aspecto actual se conservará durante esa migración.

Cuando la aplicación técnica esté probada, se incorporará la persistencia de
temas personalizados. En ese momento se modelarán únicamente las reglas que ya
sean necesarias: propiedad, nombre, tema oficial base y valores visuales
admitidos. No se crearán jerarquías, eventos ni servicios de dominio sin un
comportamiento que los requiera.

## Definición y resolución

Los temas oficiales viven en CSS versionado dentro del repositorio. Un tema
personalizado almacena en SQL su nombre, propietario, tema oficial base y
sobrescrituras estructuradas. No almacena CSS libre.

La resolución aplica estas capas, en orden:

1. valores seguros del contrato visual;
2. valores completos del tema oficial base;
3. sobrescrituras guardadas por el usuario;
4. modo claro u oscuro efectivo del lector.

El resultado contiene únicamente atributos y variables CSS ya validados para
las paletas clara y oscura. Los layouts lo aplican sobre el elemento raíz y el
contrato CSS selecciona la paleta mediante `data-color-mode` o
`prefers-color-scheme` cuando la preferencia es `system`. Los componentes
consumen las mismas variables sin conocer si el origen fue oficial o
personalizado.

## Personalización inicial

La primera versión permite modificar solo propiedades que puedan validarse y
representarse sin CSS arbitrario:

- paleta clara y oscura: fondo de página, superficie, texto, texto secundario,
  acento y borde;
- familia tipográfica desde un catálogo cerrado;
- forma de controles y paneles mediante presets de radio;
- densidad de contenido mediante presets;
- decoración de página mediante presets conocidos.

Los colores aceptan inicialmente hexadecimal de seis dígitos. Las demás
propiedades usan identificadores cerrados que el módulo traduce a CSS. Las
claves desconocidas, valores inválidos y texto CSS se rechazan.

## Persistencia

Una tabla propia de `theme` conserva temas personalizados:

```text
theme
  id
  owner_id
  name
  base_theme_id
  tokens_json
  created_at
  updated_at
```

`owner_id` es una identidad escalar recibida desde la capa HTTP autenticada; el
esquema de `theme` no importa el esquema de autenticación. El repositorio del
módulo materializa y valida `tokens_json` antes de entregar una definición a la
aplicación.

La referencia seleccionada se guarda en `nanobook.settings`. Los nanobooks
existentes sin referencia usan `classic`; los nuevos usan el tema oficial
`nanobook`. Si una referencia personalizada no puede resolverse, la lectura usa
`classic` y no emite CSS parcialmente validado.

## Capacidades públicas

El compositor `ThemeModule` expone objetos de aplicación ya compuestos, no su
repositorio ni sus adaptadores:

- resolver el tema oficial de la plataforma;
- resolver una referencia para renderizar un nanobook;
- comprobar y devolver una referencia que un usuario puede asignar;
- listar los temas administrables por un usuario;
- controladores protegidos para crear y actualizar temas.

La raíz de aplicación consume estas capacidades. Los demás módulos no importan
clases internas de `theme`.

## Experiencia de usuario

La pantalla de temas permite crear una personalización desde `nanobook` o
`classic`, previsualizar ambos modos, guardar los cambios y volver a editarla.
La gestión de nanobooks permite seleccionar un tema oficial o uno propio. Una
edición guardada se refleja en todos los nanobooks que referencian ese tema.

No habrá borrado de temas en esta primera entrega, evitando definir todavía qué
ocurre con las referencias activas. Tampoco habrá borradores o publicación: el
editor muestra una previsualización local y el cambio se vuelve efectivo al
guardar.

## Fuera de alcance inicial

- CSS, HTML o JavaScript arbitrario proporcionado por usuarios.
- Carga de fuentes, imágenes o archivos decorativos.
- Marketplace o publicación pública de temas.
- Copias, historial de revisiones, borradores y rollback.
- Eliminación de temas personalizados.
- Temas por documento o por sección.
- Sustitución estructural de layouts y componentes.
- Tokens libres o extensiones no reconocidas por el módulo.

## Criterios de aceptación

- `classic` conserva el aspecto actual y `nanobook` expresa el lenguaje visual
  de la landing usando los mismos componentes.
- El HTML SSR incluye el tema y modo efectivos; no depende de ejecutar
  JavaScript para obtener la apariencia inicial.
- Un usuario crea, guarda, lista y actualiza temas propios, pero no modifica los
  de otro usuario ni los oficiales.
- Un tema personalizado puede reutilizarse en varios nanobooks y sus cambios
  guardados se reflejan en todos ellos.
- Un nanobook público aplica su tema a lectores sin sesión sin exponer datos del
  propietario.
- Valores inválidos o referencias inexistentes nunca producen CSS arbitrario;
  la lectura cae de forma segura a `classic`.
- `theme` no importa implementaciones ni tipos internos de otros módulos de
  negocio.
- Build y pruebas focalizadas pasan, `CHANGELOG.md` queda actualizado y la
  decisión se documenta en `src/content/nanobook-project/`.
