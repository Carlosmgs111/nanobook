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

En Vercel se fuerzan cookies `Secure` y el límite de solicitudes toma la IP de `x-vercel-forwarded-for`, cabecera emitida por la plataforma. Si el despliegue usa un proxy anterior a Vercel, revisar cómo se conserva la IP real antes de depender de límites por IP.

El despliegue debe usar HTTPS, backup y restauración probada de la base, y monitoreo de errores de login, correo, migración y límites `429`. Las páginas y APIs privadas deben probarse en Production tras el despliegue. Antes de abrir el registro público conviene definir quién puede crear cuentas y nanobooks; hoy el registro está abierto para cualquier correo verificable.

## Administración desde un entorno agéntico

Actualmente las APIs de nanobooks, documentos, perfiles y temas aceptan sesiones de navegador. Un agente remoto no dispone de un conector ni de una credencial propia, y no debe reutilizar la cookie personal del navegador. Para habilitarlo hacen falta:

1. Una instancia desplegada y accesible con base y correo operativos.
2. Credenciales para máquinas con propietario, permisos por operación y nanobook, vencimiento, revocación y rotación. El plugin API Key de Better Auth es una opción, pero necesita instalarse, migrar su esquema y conectar la verificación a los controladores propios. Agregar el plugin por sí solo no autoriza las APIs de Nanobook.
3. Un servidor MCP o conector que exponga herramientas tipadas (`list_nanobooks`, `get_document`, `create_document`, `update_document`, `publish_document`, etc.) sobre las APIs existentes, sin compartir secretos con el modelo. Debe incluir confirmación para borrados, registros de auditoría e idempotencia para escrituras reintentadas.
4. Configurar el conector en el entorno agéntico, guardar su credencial como secreto y probar permisos de lectura y escritura con un nanobook de prueba.

La integración agéntica queda como trabajo pendiente: no hay servidor MCP ni autenticación de máquina en este cambio.
