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

## Documentación de decisiones

Las decisiones arquitectónicas, bugs importantes y cambios de convenciones deben documentarse en `src/content/nanobook-project/` cuando aporten contexto para futuras sesiones.
