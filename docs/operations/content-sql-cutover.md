# Corte de contenido a SQL

Este procedimiento migra el contenido histórico de Nanobook a la base administrada por la instancia. Debe ejecutarse sobre una copia consistente del origen y con las escrituras congeladas durante la importación.

El preflight local ya fue ejecutado sobre 101 documentos: la verificación terminó sin diferencias y la exportación produjo 68 documentos del nanobook raíz. Estos resultados no sustituyen la ejecución contra la base y el snapshot productivos.

## 1. Preparar la base

Configura `DATABASE_URL` y, si se usa libSQL remoto, `DATABASE_AUTH_TOKEN` solo en el entorno del servidor. No guardes esos valores en el manifiesto ni en el contenido.

```powershell
npm run database:migrate
```

La migración crea `nanobook`, `document`, revisiones, outbox y `nanobook_alias`. El comando es idempotente.

## 2. Crear y revisar el manifiesto

El manifiesto debe declarar cada destino, su propietario, visibilidad y raíz histórica. Cada índice con `nanobook: true` requiere una decisión explícita: `independent` lo convierte en la raíz de un nanobook o `directory` lo conserva como directorio normal.

Ejemplo mínimo:

```json
{
  "source": { "type": "filesystem", "root": "./src/content" },
  "destinations": [
    {
      "nanobookId": "uuid-estable",
      "sourceRoot": "index",
      "slug": "manual",
      "ownerId": "usuario-existente",
      "visibility": "public",
      "settings": {}
    }
  ],
  "boundaries": []
}
```

No reutilices un `nanobookId` para otro destino. El manifiesto no debe contener tokens, contraseñas ni URLs con credenciales.

## 3. Simular, importar y verificar

```powershell
npm run content:import-sql -- --manifest migration-manifest.json --dry-run
npm run content:import-sql -- --manifest migration-manifest.json --apply
npm run content:verify-sql -- --manifest migration-manifest.json
```

La verificación debe terminar sin diferencias. Comprueba especialmente cantidad de documentos, IDs, propietarios, cuerpos, rutas, padres, metadatos, referencias y aliases. Si falta un alias, la URL histórica no puede considerarse migrada.

Los scripts históricos que añadían identidades o propietarios al frontmatter ya fueron retirados después de comprobar que el snapshot local no tenía documentos pendientes. La identidad, el propietario y la ruta son autoritativos en SQL; no deben reintroducirse mediante edición de Markdown.

La importación es idempotente para documentos y aliases idénticos. Si encuentra el mismo ID con otra asignación, ruta o hash, se detiene sin sobrescribirlo.

Durante la transición, `metadata.nanobook` se interpreta únicamente al clasificar el snapshot histórico. Las rutas canónicas SQL reciben la raíz `index` desde `NanobookContext`; sus endpoints de creación y edición descartan esa marca y cualquier campo desconocido, por lo que no se puede volver a crear una frontera implícita desde el editor. La navegación ya no lee esa marca: el alcance siempre proviene del contexto explícito del nanobook.

## 4. Validar antes del corte

Exporta una colección de prueba para revisar la representación Markdown:

```powershell
npm run content:export-sql -- --nanobook-id <id> --out ./tmp/exported-content
```

Mide lecturas desde el mismo despliegue y con el mismo corpus:

```powershell
npm run content:benchmark -- --source sql --nanobook-id <id> --iterations 1000 --concurrency 1
npm run content:benchmark -- --source sql --nanobook-id <id> --iterations 1000 --concurrency 10
```

Para comparar con el origen GitHub, proporciona `GITHUB_OWNER`, `GITHUB_REPO` y las variables de rama/ruta correspondientes y repite cambiando `--source github`. Compara p50, p95, p99, errores y llamadas de red con la misma condición de caché.

El benchmark reutiliza el catálogo del repositorio durante una ejecución. Para comparar lectura fría, ejecuta cada medición en un proceso separado; para lectura caliente, usa varias iteraciones en el mismo proceso.

## 5. Activar el corte

Antes de activar SQL:

- conserva un backup verificable de la base y el snapshot del origen;
- detén webhooks e importadores que todavía escriban en GitHub;
- confirma que los usuarios y propietarios del manifiesto existen;
- prueba login, nanobooks públicos/privados, aliases, creación, edición, renombrado, borrado y conflictos 409.

Después configura:

```text
NANOBOOK_SQL_CUTOVER=true
```

Reinicia la instancia y repite las pruebas de humo. Con el corte activo, una ruta legacy sin alias responde `410` y la API mutante antigua queda bloqueada; no se debe caer silenciosamente al filesystem.

## 6. Reversión y recuperación

Si aún no se aceptaron escrituras SQL, desactiva el corte y vuelve al origen congelado. Después de aceptar escrituras SQL, primero exporta los cambios, bloquea nuevas mutaciones y reconcilia altas, cambios y borrados antes de restaurar otra fuente.

Prueba también un restore de backup, una caída después del commit, un conflicto de revisión y el despacho de eventos pendientes. No restaures una copia antigua de la base completa: contiene cuentas y sesiones que pueden haber cambiado.
