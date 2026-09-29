---
id: "user-module-design-2026-09-29"
title: "Diseño del módulo user"
description: "Diseño inicial del módulo de identidad y perfil de usuario para Nanobook."
date: 2026-09-29
author: "Nanobook Team"
tags:
  - arquitectura
  - user
  - modulo
draft: false
---

# Diseño del módulo `user`

## Objetivo

Introducir un módulo independiente para administrar la identidad estable y los datos básicos del perfil de usuario. El módulo debe poder probarse sin Astro, navegador, HTTP ni una base de datos concreta.

## Alcance inicial

El primer incremento incluye:

- `UserId` como identidad opaca y estable.
- `User` con email normalizado, nombre visible y auditoría temporal.
- Casos de uso para crear, consultar por ID, consultar por email, actualizar perfil y eliminar.
- Puerto `UserRepository` y adaptador `InMemoryUserRepository`.
- Composition root `UserModule` integrado en `Application`.

Quedan fuera de este diseño la autenticación, contraseñas, proveedores externos de identidad, sesiones, roles, permisos, autorización HTTP y una persistencia de producción. Esas capacidades requieren contratos propios y no deben filtrarse al modelo de perfil.

## Modelo de dominio

```ts
type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};
```

`UserId` se genera con UUID cuando no se proporciona uno y solo acepta valores opacos no vacíos. El email se normaliza con `trim().toLowerCase()` antes de validar o persistir. El nombre visible debe contener texto después de eliminar espacios exteriores. `createdAt` y la identidad no cambian durante una actualización; `updatedAt` se reemplaza por la fecha de la operación.

La unicidad del email se expresa en el repositorio usando su forma normalizada. La identidad nunca se deriva del email, porque el email puede cambiar.

## Capas y dependencias

```text
Application
  └── UserModule
      ├── application use cases
      ├── domain User/UserId/ports
      └── infrastructure repository
```

- `domain/` contiene invariantes y contratos puros.
- `application/` coordina repositorio y dominio, y devuelve DTOs serializables.
- `infraestructure/` implementa persistencia y traduce errores técnicos.
- `index.ts` construye una instancia coherente del módulo.
- `Application.ts` conecta módulos; ninguna ruta necesita conocer cómo se construye el repositorio.

## Errores

El dominio devuelve `InvalidUserError` e `InvalidUserIdError` mediante `Result`. El adaptador devuelve `UserRepositoryError` para fallos de almacenamiento y `UserEmailAlreadyExistsError` para conflictos de unicidad. Los casos de uso exponen `UserNotFoundError` para consultas, actualizaciones y eliminaciones de usuarios inexistentes.

## Evolución prevista

Una persistencia real debe conservar la unicidad de email dentro de una transacción o restricción de base de datos. Si se añade autenticación, sus credenciales y sesiones deben pertenecer a puertos y modelos separados, aunque puedan referenciar `UserId`.
