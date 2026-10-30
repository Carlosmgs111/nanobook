# Despliegue SQL de una instancia nueva

La instancia nueva comienza sin contenido importado. Los usuarios y sus nanobooks se crean directamente en la base SQL administrada por la instancia; no se configura GitHub ni se ejecuta una migración de documentos locales.

## 1. Preparar la base

Configura `DATABASE_URL` y, si se usa libSQL remoto, `DATABASE_AUTH_TOKEN` únicamente en el entorno del servidor. No guardes esos valores en el contenido, manifiestos ni logs.

### Turso para Vercel

1. Crea una base Turso dedicada a Nanobook. Copia su URL `libsql://...` a `DATABASE_URL`.
2. Crea un token de base de datos con lectura y escritura. Guárdalo como `DATABASE_AUTH_TOKEN` en Vercel Production. La aplicación no usa un token de administración de la plataforma Turso.
3. Configura ambas variables en el entorno de ejecución del comando de migración y ejecútalo **una vez antes de publicar** la nueva versión. No incluyas secretos en argumentos de comandos ni en archivos versionados.
4. Comprueba que aparecen las tablas `user`, `session`, `rateLimit`, `nanobook`, `document` y `theme` en el panel de Turso.

Para desarrollo local conserva una base separada de Production, por defecto `file:./data/nanobook.db`. Si necesitas probar contra Turso, crea otra base o rama de prueba y usa credenciales diferentes. La base de Production tiene protección contra borrado y debe tener respaldos periódicos.

```powershell
npm run database:migrate
```

El comando aplica las migraciones Drizzle de usuarios, nanobooks, documentos, revisiones y outbox. Es idempotente.

### Servidor MCP para agentes

Las migraciones `0011`, `0012` y `0013` añaden las tablas de OAuth, JWKS y el
registro de auditoría del servidor MCP. Deben estar aplicadas antes de desplegar código que
publique `POST /mcp`; el mismo comando anterior cubre todos los entornos:

```bash
npm run database:migrate
```

Configura `BETTER_AUTH_URL` con el origen HTTPS canónico sin una ruta. El
recurso que se registra para OAuth es `${BETTER_AUTH_URL}/mcp`. En desarrollo
se permite loopback; fuera de él no se activa una URL HTTP. El primer cliente
admitido es Codex y descubre su metadata de cliente de forma dinámica durante
la conexión, por lo que no se debe copiar un `client_id`, secreto, cookie o
token a variables de entorno.

Prueba manualmente después de desplegar: añade el recurso MCP en Codex, inicia
sesión en Nanobook, concede `nanobooks:read` y `nanobooks:write`, lista los
nanobooks y crea un documento de prueba. Confirma que una actualización con
revisión obsoleta devuelve conflicto y que el registro
`agent_operation_audit` contiene la mutación sin contenido ni tokens. Para
desconectar el cliente, revoca la concesión OAuth desde la gestión de sesiones
o autorizaciones de Better Auth; el refresh token queda inválido de inmediato
y cualquier access token existente caduca en como máximo quince minutos.

## 2. Crear el primer nanobook

Inicia la aplicación, crea o registra el primer usuario y usa `/nanobooks` para crear su colección. La operación crea el nanobook y su documento raíz `index` en una sola transacción.

La API nunca recibe proveedor de almacenamiento, credenciales, `ownerId`, `nanobookId` ni configuración arbitraria desde el navegador.

## 3. Validar el entorno

Comprueba:

- lectura pública y privada según la visibilidad del nanobook;
- creación, edición, renombrado y borrado dentro del nanobook;
- aislamiento entre dos nanobooks con rutas iguales;
- conflictos de revisión `409`;
- persistencia después de reiniciar el servidor;
- recuperación de eventos pendientes del outbox.

Las rutas canónicas son `/n/<nanobookSlug>/...` y las mutaciones usan `/api/nanobooks/<nanobookId>/documents/<id>`.

## 4. Operación y respaldo

Usa el mecanismo de backup del proveedor SQL y prueba la restauración sobre una base separada. Conserva las migraciones Drizzle y no reemplaces la base completa si contiene usuarios o sesiones que hayan cambiado; restaura datos de contenido según el procedimiento del proveedor.

El contenido se administra exclusivamente en SQL. El webhook de GitHub y las rutas legacy de mutación responden `410`.

## 5. Desarrollo local

Para trabajar localmente usa la base por defecto `file:./data/nanobook.db` y ejecuta `npm run database:migrate` antes de iniciar la aplicación. El contenido existente bajo `src/content` sirve como documentación y fixtures; no es una fuente de sincronización del runtime.
