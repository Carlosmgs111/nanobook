# Pruebas del módulo de hojas

Documento para probar a mano los bloques `spreadsheet` y `spreadsheet-totals`: casos válidos, límites y errores.
Pégalo en el editor de un nanobook o publícalo con el MCP.

## 1. Hoja mínima

Sin etiquetas de columna ni título; de solo lectura por defecto.

```spreadsheet
rows:
  - [1, 2, 3]
  - [4, 5, 6]
```

## 2. Hoja editable con etiquetas

Haz clic en una celda y escribe. Lo que cambias no se guarda en el documento.

```spreadsheet
title: Presupuesto editable
columns: [Concepto, Mensual, Anual]
readOnly: false
rows:
  - [Arriendo, 1800000, 21600000]
  - [Servicios, 350000.5, 4200006]
  - [Mercado, 900000, 10800000]
```

## 3. Filas de distinto largo

La segunda fila tiene una celda de menos y la tercera una de más; la hoja se rellena hasta la fila más ancha.

```spreadsheet
title: Filas irregulares
columns: [A, B, C]
rows:
  - [uno, dos, tres]
  - [cuatro, cinco]
  - [seis, siete, ocho, nueve]
```

## 4. Valores variados

Negativos, decimales, texto, celdas vacías (`null`) y texto que parece código: se escapa y no se ejecuta.

```spreadsheet
title: Tipos de celda
columns: [Tipo, Valor]
rows:
  - [Entero, 42]
  - [Negativo, -7.25]
  - [Vacío, null]
  - [Texto, "hola, mundo"]
  - [Etiqueta, "<b>negrita</b> <script>alert(1)</script>"]
  - [Fecha como texto, "2026-11-13"]
```

## 5. Totales con todas las funciones

La columna «Región» no tiene números (muestra «—» y cuenta 0); la celda vacía de Este en marzo se ignora.

```spreadsheet-totals
title: Resumen semestral
columns: [Región, Enero, Febrero, Marzo]
functions: [sum, average, min, max, count]
rows:
  - [Norte, 120, 135, 128]
  - [Sur, 98, 101, 110]
  - [Este, 76, 80, null]
  - [Oeste, 143, 139, 150]
```

## 6. Totales con la función por defecto

Sin `functions` se calcula solo la suma.

```spreadsheet-totals
columns: [Mes, Ventas]
rows:
  - [Enero, 10.5]
  - [Febrero, 20.25]
```

## 7. Errores esperados

Los tres siguientes deben verse como recuadros de error «Componente … inválido», sin romper el resto del documento.

Campo desconocido:

```spreadsheet
rows: [[1]]
colour: rojo
```

Hoja sin filas:

```spreadsheet
title: Vacía
rows: []
```

Función inexistente:

```spreadsheet-totals
columns: [A]
rows: [[1]]
functions: [mediana]
```

## 8. Nombre casi correcto

El nombre tiene una errata, así que no es un bloque conocido y se publica como código (el validador del MCP lo señala).

```spreadsheet-total
columns: [A]
rows: [[1]]
```

## 9. Un bloque dentro de una lista

Solo los bloques de raíz se pintan como componente; este, anidado, se muestra como código.

- Elemento con una hoja dentro:

  ```spreadsheet
  rows: [[1, 2]]
  ```

Fin del documento: este párrafo debe aparecer después de todo lo anterior.
