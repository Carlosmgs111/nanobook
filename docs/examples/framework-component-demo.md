# Demo de componentes de framework

Documento de prueba manual para los bloques de framework (`counter-demo` y `price-chart`, React).
Publícalo en un nanobook y comprueba lo que indica cada sección.

## 1. Bloque de raíz con valores explícitos

Debe verse como una isla ya renderizada en el HTML inicial, con el valor `3`, y
responder a los clics tras hidratar (al entrar en el viewport).

```counter-demo
label: Primer contador
start: 3
```

## 2. Valores por defecto

Con un objeto vacío usa `label: Contador` y `start: 0`. (Una fence totalmente
vacía no es válida: el YAML vacío es `null` y muestra el error de la sección 6.)

```counter-demo
{}
```

## 3. Texto entre bloques conserva el orden

Este párrafo debe aparecer entre los dos contadores, en el mismo orden que en el
Markdown.

```counter-demo
label: Segundo contador
start: 10
```

## 4. Gráfico de precios

`price-chart` es una isla de React: el servidor entrega el título, el hueco del
alto exacto y un resumen en texto bajo el gráfico (visible con JavaScript
desactivado); el gráfico se dibuja al hidratar, al entrar en el viewport.

```price-chart
title: ACME
height: 220
series:
  type: line
  data:
    - { time: 2026-01-02, value: 10 }
    - { time: 2026-01-05, value: 12 }
    - { time: 2026-01-06, value: 11 }
    - { time: 2026-01-07, value: 14 }
```

## 5. Bloque anidado (limitación conocida)

Dentro de una lista no es una isla: debe mostrarse el contenido de la fence tal
cual, sin hidratar.

- Elemento de lista con un componente:

  ```counter-demo
  label: Anidado
  ```

## 6. Props inválidas

Debe mostrarse un aviso de error en línea en lugar del componente.

```counter-demo
start: no-es-un-numero
```

Texto final, para comprobar que el documento no se corta tras los bloques.
