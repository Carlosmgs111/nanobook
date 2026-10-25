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

Nanobook expone `POST /mcp` como servidor MCP remoto. El transporte usa JSON-RPC del protocolo MCP; no reutiliza las rutas HTTP de la interfaz como herramientas del agente. Las herramientas disponibles son `list_nanobooks`, `get_nanobook`, `create_nanobook`, `update_nanobook`, `list_documents`, `get_document`, `create_document` y `update_document`. No se exponen eliminaciones.

La ruta pública `/.well-known/oauth-protected-resource/mcp` delega en Better Auth y anuncia el recurso, su servidor de autorización y los scopes disponibles. Es necesaria para que un cliente MCP pueda pasar del desafío `401` a la autorización OAuth. Como el issuer incluye la ruta `/api/auth`, también se publica la variante RFC 8414 `/.well-known/oauth-authorization-server/api/auth`; algunos clientes la derivan desde el issuer en vez de consultar `/api/auth/.well-known/oauth-authorization-server`.

## Identidad y autorización

La conexión comienza en Codex mediante OAuth 2.1. Codex descubre dinámicamente su metadata de cliente y usa PKCE; Nanobook no admite registro dinámico de clientes. El usuario inicia sesión y acepta los scopes solicitados. Better Auth emite un access token JWT de quince minutos y un refresh token rotatorio de treinta días. Revocar la concesión invalida el refresh token de inmediato; el access token deja de servir al expirar.

Cada invocación verifica el JWT y convierte sus claims `sub`, `client_id` y `scope` en el actor interno. `nanobooks:read` permite lecturas autorizadas; `nanobooks:write` permite cambios constructivos. La autorización por nanobook sigue siendo la misma regla de dominio que usa la aplicación: un libro público puede leerse, pero solo su propietario puede escribir. La propiedad individual del documento se conserva al actualizarlo.

Las respuestas de herramientas usan códigos estables: `403` para scope o permiso insuficiente, `404` para recursos ausentes y `409` para conflictos de revisión o de identidad. Los errores inesperados no revelan detalles de infraestructura.

## Operación

Antes de habilitar el endpoint en un entorno se aplican las migraciones, incluyendo `0011` (OAuth), `0012` (auditoría) y `0013` (JWKS para la firma JWT):

```bash
npm run database:migrate
```

El origen configurado en `BETTER_AUTH_URL` debe ser HTTPS fuera de loopback. En Codex se agrega ese origen como servidor MCP remoto; el cliente obtiene por sí mismo la metadata de cliente de Codex y completa el consentimiento web. Las mutaciones exitosas se registran en `agent_operation_audit` con usuario, cliente OAuth, herramienta, recurso afectado, correlación y fecha; no se almacenan tokens ni contenido de documentos.
