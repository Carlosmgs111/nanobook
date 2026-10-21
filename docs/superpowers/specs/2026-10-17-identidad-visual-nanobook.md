# Identidad visual del tema Nanobook

## Objetivo

Hacer que el tema oficial Nanobook y los temas personalizados basados en él compartan con el landing una identidad editorial inspirada en cubiertas: lomo visible, líneas finas, esquinas rectas y sombras desplazadas. Los elementos decorativos deben configurarse desde el contrato de tema, no quedar fijados en hojas CSS de componentes.

## Dirección visual

- Conservar la paleta cálida, Arial, jerarquía sobria y radios actuales del tema Nanobook.
- Usar una geometría de cubierta con lomo vertical y borde izquierdo más recto que el derecho.
- Usar diagonales finas y de bajo contraste en tarjetas, divisores y superficies decorativas. La página completa permanece sin trama por defecto.
- Usar marcas de línea en esquinas en el tema Nanobook. Mantener los estilos de tema Clásico mediante sus propios valores oficiales.
- Evitar el resplandor y el efecto de vidrio cuando el tema oficial Nanobook está activo; usar bordes y sombras de tinta desplazadas.

## Contrato de personalización

Extender los presets existentes sin permitir CSS arbitrario:

- `shape.cover`: `book | square | rounded` controla radios asimétricos, línea de lomo y ancho del lomo en tarjetas con presentación de cubierta.
- `decoration.corners`: `none | cross | line` controla las marcas de esquina en contenedores, tarjetas y bloques Markdown.
- `decoration.shadow`: `flat | offset | soft` controla elevación de paneles y tarjetas.
- Mantener `decoration.pattern`: `none | grid | hatch`; `hatch` es la trama diagonal. El preset controla el patrón de superficies decorativas. `page-pattern` sigue siendo independiente.

El catálogo oficial configura Nanobook como `cover: book`, `corners: line`, `shadow: offset` y trama diagonal sutil. Clásico conserva su cuadrícula, geometría cuadrada y elevación plana. Los temas personalizados que no incluyen los nuevos campos heredan los valores del tema base; no requieren migración de datos.

## Aplicación

El editor de temas expone los tres nuevos presets en `Forma` y `Decoración`; su vista previa debe mostrar una cubierta con lomo, una tarjeta, esquinas, una superficie rayada y una muestra Markdown para que los cambios sean visibles antes de guardar.

Los estilos consumen variables semánticas derivadas del contrato del tema. Migrar los estilos del marco del documento, navegación lateral/índice, tabla de contenido, encabezado/menús, elementos Markdown (código, listas, citas, tablas, callouts, detalles y divisores), formularios y avisos. Ningún componente de Nanobook debe tener valores de color, geometría de cubierta, trama diagonal, marcas de esquina o elevación que contradigan estos tokens.

## Compatibilidad y calidad

- Los tokens nuevos siguen validándose como enums seguros en el dominio y en los DTO.
- Los temas existentes y las respuestas del API sin esos campos conservan el fallback de su tema base.
- La vista previa local y el resultado servido usan las mismas asignaciones de presets.
- Verificar pruebas focalizadas de validación/resolución/DTO/editor y `npm run build`.
