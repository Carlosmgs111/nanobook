---
id: "d9bcaa41-e480-48b9-a4cf-972a2f742fd6"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Acceso de agentes mediante MCP y OAuth"
description: "Frontera MCP, identidad delegada, autorización y operación de Codex."
date: 2026-10-24
author: "Nanobook"
tags: ["mcp", "oauth", "agentes", "seguridad"]
draft: false
---

Nanobook expone `POST /mcp` como servidor MCP remoto. El transporte usa JSON-RPC del protocolo MCP; no reutiliza las rutas HTTP de la interfaz como herramientas del agente. El manejador admite el protocolo MCP moderno y el formato stateless anterior para interoperar con clientes que aún inician con él; ambos pasan por la misma verificación OAuth en cada solicitud. Las herramientas disponibles son `list_nanobooks`, `get_nanobook`, `create_nanobook`, `update_nanobook`, `list_documents`, `get_document`, `create_document` y `update_document`, más `get_markdown_blocks_guide` y `validate_markdown_blocks` (ver «Asistencia para escribir bloques»). No se exponen eliminaciones.

La ruta pública `/.well-known/oauth-protected-resource/mcp` delega en Better Auth y anuncia el recurso, su servidor de autorización y los scopes disponibles. Es necesaria para que un cliente MCP pueda pasar del desafío `401` a la autorización OAuth. Como el issuer incluye la ruta `/api/auth`, también se publica la variante RFC 8414 `/.well-known/oauth-authorization-server/api/auth`; algunos clientes la derivan desde el issuer en vez de consultar `/api/auth/.well-known/oauth-authorization-server`.

## Identidad y autorización

La conexión comienza en Codex mediante OAuth 2.1. Codex descubre dinámicamente su metadata de cliente y usa PKCE; Nanobook no admite registro dinámico de clientes. La política CIMD solo acepta URLs HTTPS de `chatgpt.com` en las rutas de cliente estable o específica de callback publicadas por Codex. Tras aceptar o rechazar, la página de consentimiento reconstituye exclusivamente el query cubierto por la firma de Better Auth, lo envía como JSON y navega a la URL de continuación recibida; no publica directamente un formulario HTML ni reenvía parámetros añadidos por la navegación. El token endpoint conserva `application/x-www-form-urlencoded`, como exige OAuth 2.1. Durante la validación inicial se desactiva temporalmente la guardia genérica de origen de Astro, que no admite excepciones por ruta y bloqueaba el endpoint antes del proveedor OAuth; Better Auth valida el grant, cliente, PKCE, recurso y scopes. Antes de producción debe reemplazarse por una frontera HTTP que permita aislar ese endpoint. El usuario inicia sesión y acepta los scopes solicitados. Better Auth emite un access token JWT de quince minutos y un refresh token rotatorio de treinta días. Revocar la concesión invalida el refresh token de inmediato; el access token deja de servir al expirar.

Cada invocación verifica el JWT y convierte sus claims `sub`, `client_id` y `scope` en el actor interno. `nanobooks:read` permite lecturas autorizadas; `nanobooks:write` permite cambios constructivos. La autorización por nanobook sigue siendo la misma regla de dominio que usa la aplicación: un libro público puede leerse, pero solo su propietario puede escribir. La propiedad individual del documento se conserva al actualizarlo.

Las mutaciones HTTP de documentos aplican el mismo orden de frontera:
autenticación de sesión, autorización de escritura del nanobook y, por último,
el controlador documental. La composición entrega los controladores crudos a
esa frontera; no vuelve a envolverlos con una segunda comprobación de sesión.
Las dependencias de las capacidades se tipan directamente con sus casos de uso
o con contratos que declaran una firma propia, sin alias decorativos de
`Pick<...>` o `Clase["execute"]`.

Las respuestas de herramientas usan códigos estables: `403` para scope o permiso insuficiente, `404` para recursos ausentes y `409` para conflictos de revisión o de identidad. Los errores inesperados no revelan detalles de infraestructura.

## Asistencia para escribir bloques

Un agente solo conoce del servicio lo que este le dice. Hasta esta mejora las herramientas no tenían descripción ni había `instructions` de servidor, así que nada indicaba que el contenido admite bloques financieros ni cómo escribirlos; un bloque mal formado se guardaba y el error solo se veía al abrir la página publicada. Ahora hay tres piezas, una por cada cosa que el agente ignoraba:

- **Que los bloques existen.** `NANOBOOK_MCP_INSTRUCTIONS` se entrega en `initialize` y fija el orden de trabajo: guía, escribir, validar, guardar; y la regla de no inventar datos ni URLs. Todas las herramientas llevan `description`.
- **Cuál es el formato exacto.** `get_markdown_blocks_guide` devuelve en texto plano la guía de `financial-content/shared/guide`: reglas, cuándo usar cada bloque, plantillas y errores frecuentes. Los ejemplos de la guía son datos exportados y una prueba comprueba que cumplen los esquemas reales y que el documento entero de la guía valida sin problemas, de modo que no puede describir un contrato que el código ya no acepta.
- **Si se equivocó.** `validate_markdown_blocks` aplica a un contenido los mismos parsers y esquemas que el renderizado y devuelve, por cada problema, línea, bloque, campo y motivo; también señala una fence con nombre casi correcto (`financial-chartt`), que de otro modo se publicaría en silencio como código. `create_document` y `update_document` no bloquean el guardado, porque un bloque inválido ya se degrada a un recuadro de error, pero añaden un **segundo** elemento de texto con el aviso. El primero conserva su forma exacta, ya que los clientes leen de él `documentId` y `revision`.

El módulo `agents` no importa `financial-content`: depende del puerto `MarkdownBlockAdvisor` (`guide()` y `validate()`), que compone `application/server/createMarkdownBlockAdvisor.ts`. Para que otro módulo aporte sus propios bloques bastaría con extender ese adaptador.

Límites: el validador informa solo del primer problema de cada bloque financiero (como el parser) y de todos los de un componente; no comprueba que una URL exista ni que un dato sea cierto, solo su forma; y la guía vive en el servidor, de modo que un cambio de esquema exige actualizarla en el mismo commit (la prueba lo detecta si el ejemplo deja de ser válido, no si el texto se queda corto).

El esquema de `price-chart` exige ahora fechas estrictamente ascendentes porque `lightweight-charts` falla al montar si no lo son; sin esa regla el validador habría dado por buenos bloques que no se dibujan.

### El documento índice no muestra contenido

Un documento `index` (o cualquier path que termine en `/index`, que es lo que decide `DocumentPath.isIndex()`) se publica con `IndexList`: la página pinta el título, la descripción y la lista de los documentos que cuelgan de él, y **el cuerpo no se renderiza** (`DocumentPage.astro` ramifica en `entry.isIndex`). La API de escritura sí acepta cuerpo en un índice, así que un agente que guarda ahí su información la pierde sin recibir ningún error: ocurrió al crear un resumen en el índice de un nanobook nuevo.

La regla tiene dos defensas, porque una instrucción por sí sola puede ignorarse:

- **Instrucciones y descripciones.** `NANOBOOK_MCP_INSTRUCTIONS` abre con la regla: todo nanobook nace con un índice (id `root-<nanobookId>`, fijado por `CreateNanobook`), nunca se escribe información en él, al crear un nanobook se crea siempre además al menos un documento propio (por ejemplo `resumen`) y el índice solo se actualiza para ajustar título y descripción. La repiten las descripciones de `create_nanobook`, `list_documents`, `create_document` y `update_document`, que son lo que el agente lee al decidir, y el flujo de la guía de bloques.
- **Aviso al guardar.** `indexBodyWarning` (`agents/server/application`) comprueba el `path` y el contenido que el agente acaba de enviar. Si el path es un índice y hay algo más que líneas en blanco y el título de primer nivel (lo que escribe el sistema), `create_document` y `update_document` añaden un aviso en el segundo elemento de texto, combinado con el de bloques inválidos mediante `joinNotes`. El guardado no se bloquea: un índice con cuerpo es inofensivo, solo inútil.

Límites: el aviso mira únicamente lo que se envía, no un índice que ya tenía cuerpo; cualquier línea que no sea el título cuenta como cuerpo, incluidos los enlaces (la lista de hijos la genera la página sola); y no impide que el agente cree el nanobook sin añadir luego un documento, solo se lo indica.

## Operación

Antes de habilitar el endpoint en un entorno se aplican las migraciones, incluyendo `0011` (OAuth), `0012` (auditoría) y `0013` (JWKS para la firma JWT):

```bash
npm run database:migrate
```

El origen configurado en `BETTER_AUTH_URL` debe ser HTTPS fuera de loopback. En Codex se agrega ese origen como servidor MCP remoto; el cliente obtiene por sí mismo la metadata de cliente de Codex y completa el consentimiento web. Las mutaciones exitosas se registran en `agent_operation_audit` con usuario, cliente OAuth, herramienta, recurso afectado, correlación y fecha; no se almacenan tokens ni contenido de documentos.

El procedimiento de desarrollo, conexión y diagnóstico se mantiene en
[Operación local de Nanobook MCP con Codex](./operacion-local-mcp-codex).
