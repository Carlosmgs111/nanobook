# Despliegue SQL de una instancia nueva

La instancia nueva comienza sin contenido importado. Los usuarios y sus nanobooks se crean directamente en la base SQL administrada por la instancia; no se configura GitHub ni se ejecuta una migración de documentos locales.

## 1. Preparar la base

Configura `DATABASE_URL` y, si se usa libSQL remoto, `DATABASE_AUTH_TOKEN` únicamente en el entorno del servidor. No guardes esos valores en el contenido, manifiestos ni logs.

```powershell
npm run database:migrate
```

El comando aplica las migraciones Drizzle de usuarios, nanobooks, documentos, revisiones y outbox. Es idempotente.

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
