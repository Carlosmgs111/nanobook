# Diseño: composición raíz para la aplicación de navegador

## Propósito

Dar a `src/browser/` un punto de composición explícito equivalente al de
`src/server/Application.ts`. La aplicación de navegador debe construir una vez
los módulos que requiere la interfaz y exponerlos mediante una API estable,
sin que páginas o componentes creen singletones de dominio por su cuenta.

## Contexto

Tras separar los módulos por entorno, `AuthModule` y `EditionModule` viven en
`src/browser/`, pero cada uno crea y exporta su propio singleton (`authModule`
y `edition`). Esto permite que una pantalla los consuma directamente, aunque
dispersa el ciclo de vida del entorno y deja abierta la posibilidad de crear
composiciones parciales al añadir módulos nuevos.

El servidor ya resuelve esa responsabilidad con `Application.create()` y
`getApp()`. El navegador necesita el mismo límite, adaptado a que sus módulos
actuales se construyen de forma síncrona y no realizan I/O al inicializarse.

## Decisión

Crear `src/browser/Application.ts` con una clase `Application` y una función
`getApp()`:

```ts
export class Application {
  private constructor(
    public readonly authModule: AuthModule,
    public readonly editionModule: EditionModule,
  ) {}

  static create(): Application;
}

export function getApp(): Application;
```

`Application.create()` será el único lugar que invoca `AuthModule.create()` y
`EditionModule.create()`. `getApp()` conservará una única instancia por
contexto JavaScript del navegador. A diferencia de `server/Application.ts`,
ambos métodos serán síncronos: los adaptadores de navegador existentes se
pueden instanciar sin una operación asíncrona.

Se eliminarán los exports singleton `authModule` y `edition`. Los consumidores
obtendrán la aplicación mediante `getApp()` y accederán a la capacidad que
necesitan:

```ts
const app = getApp();
app.authModule.mount();
app.editionModule.renderPreview.execute(documentId);
```

## Límites y dependencias

```text
pages y componentes de browser
             │
             ▼
  browser/Application.getApp()
       ├── AuthModule
       └── EditionModule
             │
             ▼
       shared + APIs HTTP del navegador
```

- `Application` solo compone módulos de `browser`; no importa módulos de
  servidor ni variables de entorno de Astro.
- Los módulos siguen siendo responsables de sus propios casos de uso y
  adaptadores. `Application` no contiene reglas de autenticación, edición ni
  renderizado.
- `pages` conserva su rol de adaptador Astro: en el código cliente selecciona
  la capacidad desde `getApp()`, sin ensamblar dependencias.
- `toast` no pasa a formar parte de `Application` en esta entrega. Es un
  adaptador global de interfaz y añadirlo no es necesario para eliminar las
  composiciones parciales actuales.

## Migración

1. Extraer `Application` y `getApp()` en `src/browser/Application.ts`.
2. Eliminar los singletones exportados de `auth/index.ts` y `edition/index.ts`.
3. Actualizar los consumidores de autenticación y edición para usar
   `getApp()`.
4. Mantener las fábricas públicas de cada módulo para pruebas unitarias y para
   que `Application` sea su único consumidor de producción.
5. Registrar la decisión en la documentación arquitectónica del proyecto.

## Pruebas y verificación

- Una prueba de `browser/Application` comprobará que `create()` compone
  `AuthModule` y `EditionModule`.
- Otra prueba comprobará que dos llamadas a `getApp()` devuelven la misma
  instancia.
- Se actualizarán las pruebas de componentes que referencien singletones.
- La entrega debe pasar `npm test`, `npm run build` y `git diff --check`.

## Fuera de alcance

- No se cambia el comportamiento de login, logout, sesión, edición o preview.
- No se crea un contenedor de inyección de dependencias genérico.
- No se traslada infraestructura de servidor a `browser` ni se agregan nuevas
  dependencias.

## Riesgos y mitigación

`getApp()` se invocará solo desde scripts o módulos que se ejecutan en el
navegador; así se evita que los adaptadores que usan APIs web se creen durante
el renderizado de servidor. Las pruebas cubren la identidad singleton y la
composición explícita, mientras que la compilación de Astro detecta cualquier
importación accidental de dependencias de servidor.
