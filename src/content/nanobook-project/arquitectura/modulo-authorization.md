---
id: "b4f2d7a1-3c58-4e69-9a0d-6e1f8c2b5d74"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Módulo authorization"
description: "Decisión: una sola decisión de acceso para toda la aplicación, con políticas que registra cada módulo dueño de un recurso."
date: 2026-11-17
author: "Claude"
tags: ["arquitectura", "autorización", "seguridad"]
draft: false
---

## Qué es y por qué existe

`src/authorization/server` es el único lugar donde se decide si un sujeto puede leer o escribir un recurso. Antes, cada módulo tenía su propio puerto de escritura, sus propios casos de uso de autorización y un guard HTTP, con reglas duplicadas y respuestas distintas ante el mismo caso. Ahora el motor es genérico y cada módulo aporta solo sus reglas como políticas.

## Contrato

- `Subject`: quién pide. `userId()` es perezoso y se resuelve una sola vez; `grantFor(resourceId)` entrega la credencial presentada para un recurso (por ejemplo el token de desbloqueo de un documento).
- `Resource`: `type`, `id`, `nanobookId` opcional y `attributes` opcionales. Los atributos son hechos que calcula código de servidor del módulo dueño; nunca vienen del cliente.
- `Action`: `read` o `write`.
- `Decision`: `allow`, `abstain` (la política no se pronuncia), `deny` con motivo (`unauthenticated`, `forbidden`, `not-found`) o `challenge` de tipo `password`.
- `Policy`: declara los tipos de recurso que evalúa (`appliesTo`) y una función `evaluate(request, authorize)`; con `authorize` puede consultar otra acción sobre el mismo recurso, sin volver nunca a sí misma.

## Reglas del motor

`createAuthorizer(policies)` evalúa todas las políticas aplicables y combina el resultado así:

1. `deny` prevalece sobre todo.
2. Sin `deny`, un `challenge` prevalece sobre `allow`.
3. Conceder exige al menos un `allow` explícito. Si todas se abstienen, o no hay políticas aplicables, el resultado es `deny(forbidden)`: falla cerrado.
4. Una decisión malformada o un motivo desconocido nunca concede.
5. Un fallo técnico de una política lanza `AccessCheckFailedError` y nunca concede. `Authorizer.require` lo devuelve como `Result.fail`.

El arreglo de políticas se consulta en cada llamada: cada módulo añade la suya al componerse, después de crear el autorizador.

## Las políticas actuales

- `NanobookAccessPolicy` (módulo `nanobooks`): decide recursos `nanobook` y `document` por dueño y visibilidad del nanobook. Un ajeno que escribe en un nanobook privado, o en uno inexistente, recibe `deny(not-found)`; sobre uno público, `deny(forbidden)`. La lectura de un nanobook público se concede a cualquiera.
- `DocumentPasswordPolicy` (módulo `documents`): solo actúa en `read` sobre recursos `document`. **Nunca devuelve `allow`**: se abstiene o devuelve `challenge`. Exige un grant válido por cada eslabón protegido de la cadena de enlaces, salvo que el sujeto pueda escribir en el nanobook. Un fallo de lectura del repositorio de acceso, un hash ausente o un grant manipulado, expirado o de otra versión de contraseña cuentan como «sin grant». La cadena llega en `attributes.securedIds` y la construye siempre `documentResource`.

## Cómo añadir una política

Implementar `Policy` en el módulo dueño del recurso y registrarla con `policies.push(...)` en su compositor `server/index.ts`, sobre el arreglo compartido que recibe `create(eventBus, authorizer, policies)`. Una política no concede lo que decide otra: para conceder, la del módulo dueño devuelve `allow`; las restricciones transversales (como la contraseña) solo restringen.

## Errores HTTP

`accessErrorResponse` traduce cualquier error de acceso, y es la única traducción que deben usar los controladores:

| Decisión | HTTP | Mensaje |
| --- | --- | --- |
| `deny(unauthenticated)` | 401 | Autenticación requerida |
| `deny(forbidden)` | 403 | No tienes permiso sobre este recurso |
| `deny(not-found)` | 404 | Recurso no encontrado |
| `challenge(password)` | 401 | Este recurso requiere contraseña (`challenge: "password"`) |
| `AccessCheckFailedError` | 500 | No fue posible comprobar el acceso (sin exponer la causa) |

Un ajeno sobre un nanobook privado y un nanobook inexistente reciben exactamente la misma respuesta 404, para no revelar que existe.

## Dónde se comprueba

La comprobación vive en los casos de uso, no en guards HTTP: `CreateDocument`, `UpdateDocument`, `DeleteDocument`, `SetDocumentPassword`, `ClearDocumentPassword` y los de `nanobooks` llaman a `authorizer.require` antes de cargar o cambiar nada. Así el mismo permiso se aplica igual desde HTTP, desde las herramientas MCP de agentes y desde cualquier otro adaptador. Las rutas solo se envuelven con `RouteProtector` (autenticación); los controladores devuelven 401 sin sesión y traducen los errores de acceso. El guard HTTP de escritura se retiró por redundante.

## Decisiones de rendimiento

- La lectura de un documento sin enlaces protegidos no consulta al autorizador: quien llama (la página mediante `resolveNanobookRoute`, el agente mediante `require`) ya autorizó la lectura del nanobook. Esto evita una consulta por render.
- Con enlaces protegidos se consulta una vez por documento; el listado solo consulta los documentos protegidos y excluye los denegados.
- Un agente no puede superar la contraseña: ante un `challenge` recibe `deny(forbidden)` (403 en MCP).

Relacionado: [Protección de lectura y escritura desde documents](./proteccion-lectura-escritura-documentos).
