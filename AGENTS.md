# Convenciones para agentes de código

## Versionado

El proyecto usa **Semantic Versioning** y **Conventional Commits**.

- Formato de versión: `MAJOR.MINOR.PATCH`. Actualmente estamos en `0.x.x`.
- Mensajes de commit: `tipo(alcance): descripción`.
  - `feat` — nueva funcionalidad.
  - `fix` — corrección de bug.
  - `refactor` — cambio de estructura sin cambiar comportamiento.
  - `docs` — documentación.
  - `style` — cambios visuales.
  - `chore` — tareas de mantenimiento.
- Alcances comunes: `theme`, `layout`, `sidebar`, `toc`, `content-width`, `docs`.

Antes de cualquier commit o tag, ejecutar `npm run build` y asegurarse de que pase.

## Changelog

Mantener `CHANGELOG.md` actualizado. Los cambios sin versión van en `[Unreleased]`. Al releasear, moverlos a una versión numerada con fecha.

## Tags

Crear tags anotados sobre `main`:

```bash
git tag -a v0.x.x -m "Release v0.x.x: descripción corta"
```

## Estructura de módulos

El código fuente en `src/` se organiza primero por módulo y después por entorno de ejecución. Cada módulo contiene únicamente los entornos donde tiene presencia:

```text
src/
  application/      # Composición global
    browser/        # Application y getApp del navegador
    server/         # Application y getApp del servidor
  auth/
    browser/
    server/
  documents/
    browser/
    server/
  profiles/
    browser/
    server/
  navigation/
    browser/
    server/
  publishing/server/
  theme/browser/
  toast/browser/
  layouts/          # Composición visual compartida de Astro
  pages/            # Rutas Astro y adaptadores HTTP
  content/          # Contenido publicado
  shared/           # Contratos, utilidades e infraestructura transversales
  env.d.ts          # Tipos globales de Astro
```

Reglas:
- Crear `browser/` o `server/` dentro del módulo solo cuando tenga código para ese entorno; no crear carpetas vacías.
- Los módulos de negocio en `server/` se organizan en tres capas: `domain/`, `application/` e infraestructura (`infrastructure/` o `infraestructure/`, según el módulo), más el compositor `index.ts`. No crear capas vacías. Las pruebas se ubican dentro de la capa que verifican.
- Los tipos y contratos puros no dependen de Astro ni de I/O; los adaptadores concretos contienen los side effects.
- `browser/` reúne presentación y código cliente. Los scripts que se envían al navegador no deben importar valores de servidor que arrastren secretos, I/O o APIs de Node.js.
- `server/` contiene lógica y adaptadores de servidor; no depende de APIs del navegador.
- Los componentes Astro de presentación residen en `browser/ui/`, incluso cuando su frontmatter consulta servicios de servidor: Astro ejecuta ese bloque exclusivamente en SSR. Mantener esas dependencias fuera de los bloques `<script>` cliente. Las rutas en `pages/` delegan en los módulos.
- `application/` en la raíz de `src/` conserva los puntos de composición global por entorno; no es un módulo de negocio sujeto a las tres capas.
- Evitar `core` como cajón de sastre; usar nombres que describan la responsabilidad.

## Documentación de decisiones

Las decisiones arquitectónicas, bugs importantes y cambios de convenciones deben documentarse en `src/content/nanobook-project/` cuando aporten contexto para futuras sesiones.
