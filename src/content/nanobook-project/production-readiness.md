---
title: "Despliegue y seguridad de producción"
description: "Requisitos de Vercel, política de sesión y diseño del acceso agéntico."
date: 2026-10-23
author: "Nanobook"
tags: [deployment, security, architecture]
draft: false
---

## Estado

El proyecto genera un bundle SSR para Vercel con `VERCEL=1`, pero una compilación correcta no confirma que el servicio esté listo para recibir usuarios. El archivo SQLite local solo sirve en desarrollo; las funciones de Vercel necesitan una base libSQL remota compartida. El arranque falla si `DATABASE_URL` sigue apuntando a un archivo local. Ver [operación SQL](../../../docs/operations/content-sql-deployment.md) para el procedimiento general.

Al 23 de octubre de 2026 se creó la base Turso `nanobook` y se aplicaron las once migraciones, incluida la tabla de rate limiting. El proyecto Vercel tiene en Production las ocho variables SQL, Better Auth, Resend y GitHub de la tabla siguiente. Resend tiene DKIM y SPF verificados para enviar desde `nanocraft.pro`; el estado parcial del dominio corresponde al MX de recepción, que esta aplicación no utiliza. La app OAuth de GitHub usa exclusivamente `https://nanobook-five.vercel.app/api/auth/callback/github` y no permite comodines. El commit `b90b318` se desplegó en Production con estado Ready. La página pública, el ingreso con GitHub y el área privada se comprobaron en `https://nanobook-five.vercel.app`. Aún falta probar el envío real de un correo de verificación y la restauración de un backup antes de abrir el registro a usuarios.

## Variables de producción

Configurar en Vercel, para el entorno correspondiente:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | URL `libsql://` o `libsqls://` de una base persistente. |
| `DATABASE_AUTH_TOKEN` | Token de la base remota, si el proveedor lo exige. |
| `BETTER_AUTH_URL` | Origen HTTPS canónico del sitio, sin ruta adicional. |
| `BETTER_AUTH_SECRET` | Secreto aleatorio de al menos 32 caracteres; debe ser el mismo en todas las funciones. |
| `RESEND_API_KEY` | Entrega de correos de verificación. |
| `EMAIL_FROM` | Remitente de un dominio verificado. |
| `GITHUB_OAUTH_CLIENT_ID` y `GITHUB_OAUTH_CLIENT_SECRET` | Opcionales, pero deben ir juntos y la callback debe apuntar a `/api/auth/callback/github`. |
| `CACHE_BACKEND` y `REDIS_URL` | Opcionales. En Vercel el caché por defecto es memoria de cada función; `redis` requiere Redis accesible. No usar `filesystem`. |

No se debe crear una variable `VERCEL_DEPLOY` para activar el adaptador: Vercel proporciona `VERCEL=1`. Cada Preview con dominio distinto necesita una estrategia de URL/callback y credenciales OAuth propias; una URL canónica de Production no cubre automáticamente los Preview.

## Política de seguridad

Better Auth conserva sesiones en SQL con caducidad absoluta de 12 horas. La lectura de sesión no extiende su vida. No se habilita caché de sesión en cookie, para que revocaciones y vencimiento dependan de la base. El límite de solicitudes de Better Auth usa SQL, compartido entre instancias; requiere la migración `0010`. Las rutas propias protegidas por cookie exigen `Origin` igual al origen solicitado en `POST`, `PATCH` y `DELETE`, y sus respuestas se marcan `private, no-store`. Better Auth mantiene sus propias comprobaciones de CSRF y orígenes para `/api/auth/*`.

La sesión recordada en el navegador se vuelve a consultar cada minuto; las operaciones del servidor consultan la sesión real en cada petición.

En Vercel, los enlaces de verificación de correo se normalizan al origen `BETTER_AUTH_URL`, conservando su ruta y token. Así no se envían enlaces con el host de desarrollo si el URL generado por el adaptador trae un origen local.

En Vercel se fuerzan cookies `Secure` y el límite de solicitudes toma la IP de `x-vercel-forwarded-for`, cabecera emitida por la plataforma. Si el despliegue usa un proxy anterior a Vercel, revisar cómo se conserva la IP real antes de depender de límites por IP.

El despliegue debe usar HTTPS, backup y restauración probada de la base, y monitoreo de errores de login, correo, migración y límites `429`. Las páginas y APIs privadas deben probarse en Production tras el despliegue. Antes de abrir el registro público conviene definir quién puede crear cuentas y nanobooks; hoy el registro está abierto para cualquier correo verificable.

## Administración desde un entorno agéntico

Nanobook ya expone un servidor MCP OAuth 2.1 para Codex. El usuario autoriza
scopes de lectura y escritura sobre sus propios nanobooks; las ocho herramientas
iniciales cubren consulta y mutaciones constructivas de nanobooks y documentos.
Las operaciones mutantes se auditan y no se exponen borrados.

Antes de habilitarlo en producción siguen pendientes estas condiciones:

1. Aplicar las migraciones `0011` a `0013` junto con el resto del esquema.
2. Restaurar la comprobación de origen de Astro aislando el token endpoint OAuth; hoy está desactivada temporalmente para validar el intercambio local.
3. Probar login, refresh, revocación y autorización de lectura/escritura en el origen HTTPS definitivo.
4. Definir idempotencia y confirmación explícita antes de exponer borrados u otras mutaciones irreversibles.

La arquitectura y el runbook local están en [Acceso de agentes mediante MCP y
OAuth](./arquitectura/mcp-agentes-oauth) y [Operación local de Nanobook MCP con
Codex](./arquitectura/operacion-local-mcp-codex).
