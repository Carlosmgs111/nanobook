# Ventas por región, primer semestre

Este documento usa los bloques del módulo `spreadsheets`. Los datos son ficticios.

## La hoja completa

La hoja es interactiva: se puede navegar con el teclado, y como está marcada como editable, el lector puede cambiar
cifras para ver cómo cambiarían los totales de abajo (los cambios no se guardan).

```spreadsheet
title: Ventas por región (millones de COP)
columns: [Región, Enero, Febrero, Marzo, Abril, Mayo, Junio]
readOnly: false
rows:
  - [Norte, 120, 135, 128, 150, 162, 171]
  - [Sur, 98, 101, 110, 108, 115, 124]
  - [Este, 76, 80, null, 91, 95, 99]
  - [Oeste, 143, 139, 150, 158, 166, 180]
```

## Los totales

Los totales se calculan en el servidor, sin JavaScript en el navegador. Una celda vacía (Este, marzo) se ignora, y la
columna de regiones no tiene números, así que no tiene resultado.

```spreadsheet-totals
title: Resumen por mes
columns: [Región, Enero, Febrero, Marzo, Abril, Mayo, Junio]
functions: [sum, average, max, count]
rows:
  - [Norte, 120, 135, 128, 150, 162, 171]
  - [Sur, 98, 101, 110, 108, 115, 124]
  - [Este, 76, 80, null, 91, 95, 99]
  - [Oeste, 143, 139, 150, 158, 166, 180]
```

## Una hoja de solo lectura

```spreadsheet
title: Metas del segundo semestre
columns: [Región, Meta]
rows:
  - [Norte, 1000]
  - [Sur, 700]
```
