---
id: "fddf3b9a-9d3f-4c60-a745-e9df23cb9b14"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Operación local de Nanobook MCP con Codex"
description: "Runbook para migrar, conectar, verificar y diagnosticar el servidor MCP local."
date: 2026-10-26
author: "Nanobook"
tags: ["mcp", "oauth", "codex", "operacion", "local"]
draft: false
---

Este runbook permite usar Codex como primer cliente del servidor MCP local de
Nanobook. La arquitectura, los scopes y los límites de seguridad se describen
en [Acceso de agentes mediante MCP y OAuth](./mcp-agentes-oauth).

## Preparación

Usar un checkout actualizado en `main`, con dependencias instaladas y una
configuración local cuya URL canónica sea `http://localhost:4322`. La base debe
recibir todas las migraciones antes de crear una cuenta o iniciar OAuth:

```bash
npm run database:migrate
npm run dev
```

La migración incluye, entre otras, las tablas `rateLimit`, OAuth, auditoría de
operaciones de agentes y `jwks`. Si Better Auth informa una tabla ausente, no
se debe desactivar el rate limiting: se aplica la migración pendiente.

## Conexión desde Codex

Registrar un servidor MCP remoto llamado `nanobook-local` con esta URL:

```text
http://localhost:4322/mcp
```

Después se inicia OAuth desde la CLI:

```bash
codex mcp login nanobook-local --oauth-client-registration CIMD --scopes nanobooks:read,nanobooks:write,offline_access
```

Codex abre el consentimiento de Nanobook. El usuario inicia sesión, acepta los
scopes y vuelve al cliente. La confirmación esperada es:

```text
Successfully logged in to MCP server 'nanobook-local'.
```

Una sesión de escritorio creada antes de añadir el servidor debe recargarse o
abrirse de nuevo. En CLI, `/mcp` debe informar `nanobook-local: connected (8
tools)`.

## Prueba funcional mínima

Pedir a Codex que liste los nanobooks. Luego puede crear un nanobook privado
de prueba y crear o actualizar un documento en él. Las ocho herramientas
actuales son de lectura y mutación constructiva; no se publican borrados.

La identidad del agente es la del usuario que dio consentimiento. Por ello
listar solo devuelve los nanobooks de ese usuario y toda escritura requiere
además la propiedad del nanobook.

## Diagnóstico

| Síntoma | Comprobación y corrección |
| --- | --- |
| `Auth required` al conectar | Ejecutar de nuevo `codex mcp login` y completar el consentimiento. |
| Faltan `rateLimit` o `jwks` | Ejecutar `npm run database:migrate` contra la base configurada. |
| OAuth termina pero el servidor muestra `failed (0 tools)` | Reiniciar el servidor local y abrir una sesión de Codex nueva. El endpoint acepta el formato MCP stateless usado por clientes compatibles. |
| `Invalid origin` o error al intercambiar el token | Confirmar que la app se ejecuta en el origen configurado y que el flujo use el consentimiento de Nanobook, no una llamada manual al token endpoint. |
| `Solicitud OAuth inválida o vencida` | Reiniciar el login; el query firmado del consentimiento no es reutilizable. |

## Estado de seguridad pendiente

Para validar el intercambio OAuth local se dejó `security.checkOrigin: false`
en la configuración global de Astro. Es una medida temporal y deliberada: el
proveedor Better Auth aún valida cliente, código, PKCE, recurso y scopes, pero
la protección genérica de origen de Astro no debe permanecer desactivada para
producción. Antes de desplegar este flujo se debe aislar el token endpoint en
una frontera HTTP que acepte el formulario OAuth sin relajar la comprobación
del resto de rutas.

## Mantenimiento

Cada cambio de esquema requiere una nueva migración; nunca se corrige una base
local borrando tablas de OAuth ni deshabilitando plugins. Tras actualizar
dependencias de Better Auth o MCP se repiten, como mínimo, el login, el listado
de herramientas y una lectura/escritura sobre un nanobook propio.
