---
id: "f72c8f4e-5d3a-4d96-9df3-0a4e4e8f36a1"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Contrato y aplicación de temas"
description: "Opciones para hacer propietario del módulo theme el contrato que resuelve, compila e instala los estilos."
date: 2026-10-16
author: "Nanobook Team"
tags:
  - arquitectura
  - theme
  - design-tokens
  - decision
draft: false
---

# Contrato y aplicación de temas

## Contexto actual

El módulo `theme` resuelve un tema oficial o personalizado y devuelve un
`AppliedTheme` con dos mapas de variables CSS. `Layout.astro` y
`LandingLayout.astro` convierten esos mapas en un atributo `style` y en un JSON
dentro de una etiqueta `meta`. `ThemeNavigationController` lee ese JSON después
de una navegación de `ClientRouter` y vuelve a escribir las propiedades en el
elemento raíz.

Este mecanismo es válido para una primera versión, pero reparte el contrato
entre tres lugares. `ResolveTheme` conoce nombres CSS, los layouts conocen la
serialización HTML y los componentes conocen nombres como `--theme-border` o
`--theme-page-bg`. El editor también mantiene un mapa propio entre sus campos y
las variables CSS. La consecuencia es que agregar un rol o cambiar su nombre
obliga a revisar varias capas.

## Principios

1. `theme` debe ser propietario de la resolución, la validación, la herencia,
   la compilación y la instalación del tema.
2. Los componentes deben consumir roles semánticos estables, no conocer el
   formato persistido ni los tokens que el usuario editó.
3. La salida CSS debe ser un adaptador del módulo, no el modelo de dominio.
4. Un tema personalizado debe guardar diferencias sobre un tema base y no un
   bloque CSS arbitrario.
5. La aplicación cliente debe poder reemplazar un tema completo sin dejar
   variables del nanobook anterior.

## Opción 1: proveedor CSS del módulo `theme`

El módulo conserva las variables CSS como protocolo de presentación, pero
encapsula su instalación en una capacidad propia. `ResolveTheme` devuelve un
modelo resuelto y `ThemeCompiler` produce una instalación con identidad,
atributos, CSS y estado de navegación.

```text
ThemeDefinition → ThemeResolver → ResolvedTheme → ThemeCompiler → ThemeInstallation
```

Un componente `ThemeProvider.astro`, perteneciente a `theme`, emitiría el
`<style data-nanobook-theme>`, los atributos `data-theme` y `data-color-mode`,
y el estado que necesita `ClientRouter`. Los layouts solo compondrían el
proveedor y dejarían de concatenar mapas de variables.

Es la opción con menor coste y conserva el modelo de consumo actual basado en
`var(...)`. Las custom properties son apropiadas para este caso porque se
heredan mediante la cascada, admiten valores de respaldo y pueden actualizarse
sin tocar cada componente. [MDN documenta este mecanismo](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties).

## Opción 2: registro de roles semánticos

El contrato deja de organizarse alrededor de nombres físicos como `page-bg` o
`surface-bg` y se define por intención:

```text
color.surface.page
color.surface.panel
color.content.primary
color.content.muted
color.action.primary
color.border.default
color.border.subtle
color.focus.ring
```

El módulo resuelve esos roles para los modos claro y oscuro y los publica como
variables estables, por ejemplo `--nb-color-surface-page` o
`--nb-color-content-primary`. Los componentes solo usan esos roles. Si un
componente necesita una decisión propia, se define un alias dentro de `theme`,
como `--nb-button-primary-background`, que apunta a un rol común.

Este patrón se inspira en Material Design 3, que utiliza roles como `surface`,
`on-surface`, `primary` y `outline` para separar la intención de la paleta
concreta y mantener combinaciones accesibles. [Material 3 describe sus roles de
color](https://m3.material.io/styles/color/the-color-system).

La ventaja es que la evolución visual no obliga a renombrar componentes. El
coste es migrar gradualmente los nombres actuales y definir una matriz mínima
de roles.

## Opción 3: compilador interno de tokens

El módulo puede aceptar tokens parciales, validarlos y completar los valores
desde el tema base:

```text
tokens persistidos → validación → referencias y herencia → roles completos → CSS
```

Un tema personalizado almacenaría únicamente los cambios del usuario. El
compilador produciría el mismo resultado aunque el formato interno evolucione.
También sería el lugar correcto para validar contraste, tamaños permitidos,
fuentes, radios, densidad y decoraciones.

Esta opción es compatible con las dos anteriores y permite mantener el
almacenamiento actual sin guardar fragmentos CSS ni acoplar la base de datos a
los componentes.

## Opción 4: formato interoperable de Design Tokens

Si Nanobook necesita exportar temas, importarlos desde herramientas de diseño o
generar salidas para otras plataformas, el almacenamiento podría aproximarse al
formato del Design Tokens Community Group:

```json
{
  "color": {
    "surface": {
      "page": {
        "$value": "#f7f5ef",
        "$type": "color"
      }
    }
  }
}
```

El formato utiliza `$value`, `$type` y metadatos para describir decisiones de
diseño. [La especificación DTCG define este formato de intercambio](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/).
Style Dictionary aplica una idea equivalente y transforma tokens a CSS,
JavaScript y otros destinos. [Su documentación describe los formatos y
transformaciones](https://www.styledictionary.org/reference/hooks/formats/).

No se recomienda introducir todavía una dependencia externa de compilación. La
estructura puede diseñarse compatible con DTCG y adoptar la interoperabilidad
cuando exista una necesidad real.

## Comparación

| Opción | Coste inicial | Beneficio principal | Riesgo |
| --- | --- | --- | --- |
| Proveedor CSS | Bajo | Encapsula la instalación sin cambiar todos los componentes | Mantiene nombres físicos si no se acompaña de roles |
| Roles semánticos | Medio | Contrato estable y orientado a intención | Requiere migrar variables actuales |
| Compilador interno | Medio | Herencia, defaults y validación centralizados | Añade una capa de resolución que debe probarse |
| Formato DTCG | Alto | Importación, exportación y otras plataformas | Complejidad prematura para un runtime web único |

## Recomendación

Adoptar la primera opción como frontera inmediata y la segunda como contrato
definitivo. El compilador de la tercera opción debe implementarse dentro del
mismo trabajo, pero sin cambiar todavía el formato persistido. La cuarta opción
queda como una compatibilidad futura, no como una dependencia obligatoria.

La secuencia propuesta es:

1. Crear `ThemeInstallation` y `ThemeCompiler` dentro de `theme`.
2. Mover la generación de CSS, atributos y estado de navegación fuera de los
   layouts.
3. Definir el registro de roles semánticos y publicar un namespace propio,
   por ejemplo `--nb-*`.
4. Migrar los consumidores actuales de forma incremental.
5. Hacer que los temas personalizados almacenen solo overrides válidos sobre
   un tema base.
6. Añadir reglas de contraste y, si aparece la necesidad de interoperabilidad,
   un adaptador DTCG de importación y exportación.

El resultado será un contrato único: los módulos de presentación consumen roles
CSS estables y `theme` es el único módulo que conoce cómo se resuelven,
serializan, instalan y reaplican.

## Estado

Propuesta abierta. No cambia todavía el contrato de ejecución; sirve como base
para la siguiente refactorización del módulo `theme`.
