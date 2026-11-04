# Documentos protegidos con desafío de contraseña — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir marcar un documento como protegido: quien no sea escritor del nanobook debe resolver un desafío de contraseña (misma URL) antes de que el documento se renderice.

**Architecture:** Un guard en `DocumentPage` evalúa `AuthorizeDocumentAccess` antes de publicar. La contraseña vive como hash scrypt en la tabla `document_access` (nunca en frontmatter). Un desbloqueo correcto emite una cookie HMAC por documento (12 h, ligada a `password_version`). La navegación se depura por espectador con un decorador de `NavigationService`. Una interfaz `DocumentAccessPolicy` deja el camino abierto a perfiles y niveles.

**Tech Stack:** Astro 7 SSR, TypeScript, Drizzle ORM + libSQL, `node:crypto` (scrypt, HMAC, HKDF), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-secured-documents-design.md`

---

## Correcciones a la spec descubiertas al leer el código

Estas decisiones prevalecen sobre el texto de la spec; la Tarea 0 actualiza la spec.

| # | Spec | Plan | Motivo |
|---|---|---|---|
| 1 | `secured` se serializa en `metadata_json` **y en el frontmatter bruto**; entra en `contentHash` | `secured` solo en `metadata_json`; no toca el frontmatter bruto ni el hash | `UpdateDocument` regenera el frontmatter desde una plantilla; el hash cubre solo el cuerpo y el guard ocurre antes de publicar, así que no aportan nada |
| 2 | Se elimina la fila de `document_access` al quitar la protección | La fila **persiste**; `password_hash` es nullable y `password_version` solo crece | Si se borra la fila, la versión reiniciaría en 1 y reviviría concesiones antiguas |
| 3 | Cookie `Path=/n/{slug}` | `Path=/n` | El módulo `documents` no conoce el slug del nanobook; el nombre de la cookie ya es único por documento |
| 4 | Proxy: `accessDocumentId` | **No existe.** Un proxy resuelto toma la identidad y `secured` de su destino (ya lo hace `ProxyParser`); el guard evalúa **la cadena** [documento crudo, documento resuelto] | Evita un campo nuevo y mantiene la protección propia del proxy y la de su destino |
| 5 | El desbloqueo es público | Solo para nanobooks **públicos** (404 si no) | Un nanobook privado no sirve el desafío; el endpoint no debe permitir sondear contraseñas |
| 6 | El propietario no pasa desafío | En nanobooks públicos `resolveNanobookRoute` **no lee la sesión**; para documentos protegidos la página la resuelve bajo demanda | Si no, el propietario sería desafiado |
| 7 | `password_hash` obligatorio | `password_hash` nullable (ver 2): hash nulo = nadie puede desbloquear (solo el escritor) | Falla cerrado |

## Estructura de archivos

**Crear**
- `src/documents/server/domain/access/AccessGrantPolicy.ts` — constantes de política (TTL, intentos, ventana).
- `src/documents/server/domain/access/DocumentAccessPolicy.ts` — interfaz + `PasswordAccessPolicy`.
- `src/documents/server/domain/access/ports.ts` — puertos: repositorio de acceso, hasher, codec de concesiones, limitador.
- `src/documents/server/infraestructure/access/ScryptPasswordHasher.ts`
- `src/documents/server/infraestructure/access/HmacAccessGrantCodec.ts`
- `src/documents/server/infraestructure/access/DrizzleDocumentAccessRepository.ts`
- `src/documents/server/infraestructure/access/DrizzleUnlockAttemptLimiter.ts`
- `src/documents/server/application/access/loadOwnedDocument.ts`
- `src/documents/server/application/access/SetDocumentPassword.ts`
- `src/documents/server/application/access/ClearDocumentPassword.ts`
- `src/documents/server/application/access/AuthorizeDocumentAccess.ts`
- `src/documents/server/application/access/UnlockDocument.ts`
- `src/documents/server/application/access/readCookie.ts`
- `src/documents/server/application/access/testDoubles.ts` — dobles en memoria para pruebas.
- `src/documents/server/infraestructure/rest/DocumentAccessAdminController.ts`
- `src/documents/server/infraestructure/rest/UnlockDocumentController.ts`
- `src/pages/api/nanobooks/[nanobookId]/document-access/index.ts` — `PUT` y `DELETE`.
- `src/pages/api/nanobooks/[nanobookId]/document-access/unlock.ts` — `POST` público.
- `src/navigation/server/application/restrictSecuredNavigation.ts`
- `src/shared/icons/lock.svg`
- `src/documents/browser/ui/components/DocumentUnlockForm.astro`
- `src/documents/browser/ui/components/DocumentProtectionPanel.astro`
- `drizzle/0016_document_access.sql` (generado)
- Pruebas junto a cada unidad (`*.test.ts`).

**Modificar**
- `src/documents/server/domain/types.ts`, `Document.ts`, `hash.ts`, `errors.ts`
- `src/documents/server/application/UpdateDocument.ts`
- `src/documents/server/infraestructure/database/DrizzleDocumentSchema.ts`
- `src/documents/server/index.ts` (composición)
- `src/documents/browser/ui/pages/DocumentPage.astro`, `EditPage.astro`
- `src/navigation/browser/ui/components/IndexList/DocumentIndex.astro`, `SidebarNav/SidebarList.astro`
- `CHANGELOG.md`

> **Convenciones del repo:** `CHANGELOG.md` bajo `[Unreleased]`, Conventional Commits, `npm run build` antes de cada commit. El árbol tiene un cambio ajeno sin commit en `src/auth/browser/ui/AuthFormController.ts`: **nunca** usar `git add .` ni `git add -A`; añadir archivos por nombre. Los pasos de commit suponen que se autorizan commits durante la ejecución.

---

### Task 0: Actualizar la spec con las correcciones

**Files:**
- Modify: `docs/superpowers/specs/2026-11-04-secured-documents-design.md`

- [ ] **Step 1: Editar la spec**

Aplicar estos cambios en el archivo:

1. En «Atributo `secured`»: sustituir «Se serializa en `metadata_json` y en el frontmatter bruto…» por «Se serializa solo en `metadata_json`; el frontmatter bruto no lo contiene (se regenera desde plantilla en cada guardado).» y eliminar la línea «Forma parte del `contentHash`…».
2. En «Tabla `document_access`»: `password_hash` pasa a «texto, **nullable**»; reemplazar el párrafo «Al retirar la protección se elimina la fila…» por «Al retirar la protección se pone `password_hash = NULL`, se incrementa `password_version` y `secured = false`; la fila nunca se elimina (salvo con el documento), de modo que la versión solo crece y las concesiones antiguas no reviven.»
3. En «Cookie de concesión»: `Path=/n`.
4. En «Superficies»: reemplazar la fila de proxy por «Un proxy resuelto toma la identidad y el atributo `secured` de su destino. El guard evalúa la cadena [documento crudo, documento resuelto]: cada eslabón protegido exige su propia concesión.»
5. En «Endpoint de desbloqueo»: añadir «Solo atiende nanobooks públicos; en uno privado responde `404`.»
6. En «Guard de ruta»: añadir «En nanobooks públicos la ruta no lee la sesión; si algún eslabón de la cadena está protegido, la página resuelve la sesión bajo demanda para saber si el espectador puede escribir.»

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-11-04-secured-documents-design.md docs/superpowers/plans/2026-11-04-secured-documents.md
git commit -m "docs(documents): plan de documentos protegidos y ajustes a la spec"
```

---

### Task 1: Atributo `secured` en el dominio

**Files:**
- Modify: `src/documents/server/domain/types.ts`
- Modify: `src/documents/server/domain/Document.ts`
- Modify: `src/documents/server/domain/hash.ts`
- Modify: `src/documents/server/application/UpdateDocument.ts`
- Test: `src/documents/server/domain/DocumentSecured.test.ts`
- Test: `src/documents/server/application/UpdateDocument.secured.test.ts`

- [ ] **Step 1: Escribir las pruebas que fallan**

`src/documents/server/domain/DocumentSecured.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { Document } from "./Document";
import { serializeMetadata } from "./hash";
import type { DocumentMetadata } from "./types";

const base = (overrides: Partial<DocumentMetadata> = {}): DocumentMetadata => ({
  id: "doc-1",
  title: "Guía",
  description: "Descripción",
  author: "Autora",
  ownerId: "owner-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("Document secured attribute", () => {
  it("defaults to unsecured", () => {
    const document = Document.create("guia", base(), "# Guía").getValue();

    expect(document.getMetadata().secured).toBeUndefined();
  });

  it("keeps the secured flag when declared", () => {
    const document = Document.create("guia", base({ secured: true }), "# Guía").getValue();

    expect(document.getMetadata().secured).toBe(true);
  });

  it("withSecured toggles the flag preserving identity, revision and content", () => {
    const original = Document.create("guia", base(), "# Guía", null, undefined, undefined, 4).getValue();
    const at = new Date("2026-02-02T00:00:00.000Z");

    const secured = original.withSecured(true, at).getValue();
    const open = secured.withSecured(false, at).getValue();

    expect(secured.getMetadata().secured).toBe(true);
    expect(secured.getMetadata().updatedAt).toEqual(at);
    expect(secured.getDocumentId().getValue()).toBe("doc-1");
    expect(secured.getRevision()).toBe(4);
    expect(secured.getContent()).toBe("# Guía");
    expect(open.getMetadata().secured).toBeUndefined();
  });

  it("serializes the flag only when it is true", () => {
    const secured = serializeMetadata(Document.create("guia", base({ secured: true }), "").getValue().getMetadata());
    const open = serializeMetadata(Document.create("guia", base(), "").getValue().getMetadata());

    expect(JSON.parse(secured).secured).toBe(true);
    expect(JSON.parse(open)).not.toHaveProperty("secured");
  });
});
```

`src/documents/server/application/UpdateDocument.secured.test.ts`:

```ts
import { describe, expect, it, vi, type Mock } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { DocumentInput } from "./dto/DocumentInput";
import { buildDocumentInput, createEventBus, createRepository } from "./test/factories";
import { UpdateDocument } from "./UpdateDocument";

function existingSecuredDocument() {
  return Document.create(
    "intro",
    {
      id: "doc-1",
      title: "Intro",
      description: "Descripción",
      author: "Autora",
      ownerId: "owner-1",
      secured: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    "# Antiguo",
    null,
    undefined,
    undefined,
    3,
  ).getValue();
}

describe("UpdateDocument and the secured flag", () => {
  it("preserves secured when the document is edited", async () => {
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(existingSecuredDocument())),
    });

    const result = await new UpdateDocument(repository, createEventBus()).execute(
      "book-a",
      buildDocumentInput({ id: "doc-1", path: "intro" }),
      "owner-1",
    );

    expect(result.isSuccess).toBe(true);
    const saved = (repository.updateMany as Mock).mock.calls[0][1][0].document as Document;
    expect(saved.getMetadata().secured).toBe(true);
  });

  it("ignores a secured value sent by the client", async () => {
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(existingSecuredDocument())),
    });
    const tampered = { ...buildDocumentInput({ id: "doc-1", path: "intro" }), secured: false } as DocumentInput;

    await new UpdateDocument(repository, createEventBus()).execute("book-a", tampered, "owner-1");

    const saved = (repository.updateMany as Mock).mock.calls[0][1][0].document as Document;
    expect(saved.getMetadata().secured).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npx vitest run src/documents/server/domain/DocumentSecured.test.ts src/documents/server/application/UpdateDocument.secured.test.ts`
Expected: FAIL (`withSecured is not a function`, `secured` ausente en los metadatos).

- [ ] **Step 3: Implementar**

`src/documents/server/domain/types.ts` — añadir tras `draft?: boolean | undefined;`:

```ts
  /**
   * Server-managed flag. Readers without write access must pass a password
   * challenge before the document is rendered. Never accepted from clients.
   */
  secured?: boolean;
```

`src/documents/server/domain/Document.ts`:

1. En el constructor, dentro del objeto que se pasa a `Document.toDocumentMetadata`, tras `draft: overrides.draft ?? false,` añadir:
```ts
        secured: overrides.secured,
```
2. En `toDocumentMetadata`, tras `draft: (data.draft as boolean) ?? false,` añadir:
```ts
      secured: data.secured === true ? true : undefined,
```
3. Añadir el método junto a `withRevision`:
```ts
  withSecured(
    secured: boolean,
    updatedAt: Date,
  ): Result<InvalidDocumentError | InvalidDocumentIdError, Document> {
    return Document.create(
      this.getPath(),
      { ...this.metadata, secured: secured ? true : undefined, updatedAt },
      this.content,
      this.parser,
      undefined,
      this.getDocumentId().getValue(),
      this.revision,
    );
  }
```

`src/documents/server/domain/hash.ts` — en `serializeMetadata`, tras `draft: metadata.draft,`:

```ts
    secured: metadata.secured,
```

`src/documents/server/application/UpdateDocument.ts` — en el objeto de metadatos de `Document.create(...)`, bajo el comentario «Identity and audit metadata…», añadir tras `ownerId: existingMetadata.ownerId,`:

```ts
        // Server-managed: clients can never change the protection flag.
        secured: existingMetadata.secured,
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npx vitest run src/documents/server/domain src/documents/server/application`
Expected: PASS (todas las pruebas existentes del dominio y de la aplicación siguen verdes).

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/domain/types.ts src/documents/server/domain/Document.ts src/documents/server/domain/hash.ts src/documents/server/application/UpdateDocument.ts src/documents/server/domain/DocumentSecured.test.ts src/documents/server/application/UpdateDocument.secured.test.ts
git commit -m "feat(documents): atributo secured gestionado por el servidor"
```

---

### Task 2: Política de acceso, puertos y errores

**Files:**
- Create: `src/documents/server/domain/access/AccessGrantPolicy.ts`
- Create: `src/documents/server/domain/access/DocumentAccessPolicy.ts`
- Create: `src/documents/server/domain/access/ports.ts`
- Modify: `src/documents/server/domain/errors.ts`
- Test: `src/documents/server/domain/access/DocumentAccessPolicy.test.ts`

- [ ] **Step 1: Escribir la prueba que falla**

`src/documents/server/domain/access/DocumentAccessPolicy.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { PasswordAccessPolicy } from "./DocumentAccessPolicy";

describe("PasswordAccessPolicy", () => {
  const policy = new PasswordAccessPolicy();

  it("allows documents that are not secured", () => {
    expect(policy.evaluate({ secured: false, canWrite: false, hasValidGrant: false })).toEqual({ kind: "allow" });
  });

  it("allows writers without a grant", () => {
    expect(policy.evaluate({ secured: true, canWrite: true, hasValidGrant: false })).toEqual({ kind: "allow" });
  });

  it("allows readers holding a valid grant", () => {
    expect(policy.evaluate({ secured: true, canWrite: false, hasValidGrant: true })).toEqual({ kind: "allow" });
  });

  it("challenges everyone else with a password", () => {
    expect(policy.evaluate({ secured: true, canWrite: false, hasValidGrant: false })).toEqual({
      kind: "challenge",
      method: "password",
    });
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/documents/server/domain/access`
Expected: FAIL (módulo no encontrado).

- [ ] **Step 3: Implementar**

`src/documents/server/domain/access/AccessGrantPolicy.ts`:

```ts
/** Tunable durability and abuse limits of document access grants. */
export interface AccessGrantPolicy {
  /** Absolute lifetime of a grant after a successful unlock. */
  readonly ttlSeconds: number;
  /** Failed attempts allowed per document and client within the window. */
  readonly maxFailures: number;
  readonly failureWindowSeconds: number;
}

export const DEFAULT_ACCESS_GRANT_POLICY: AccessGrantPolicy = Object.freeze({
  ttlSeconds: 12 * 60 * 60,
  maxFailures: 5,
  failureWindowSeconds: 15 * 60,
});
```

`src/documents/server/domain/access/DocumentAccessPolicy.ts`:

```ts
export type AccessDecision =
  | { kind: "allow" }
  | { kind: "challenge"; method: "password" };

export interface AccessEvaluationInput {
  secured: boolean;
  /** The viewer can write in the nanobook (owner). */
  canWrite: boolean;
  /** The viewer presented a currently valid grant for this document. */
  hasValidGrant: boolean;
}

/**
 * Decides whether a viewer may read a document. Password is the only method
 * today; profiles or levels can implement the same interface later.
 */
export interface DocumentAccessPolicy {
  evaluate(input: AccessEvaluationInput): AccessDecision;
}

export class PasswordAccessPolicy implements DocumentAccessPolicy {
  evaluate({ secured, canWrite, hasValidGrant }: AccessEvaluationInput): AccessDecision {
    if (!secured || canWrite || hasValidGrant) return { kind: "allow" };
    return { kind: "challenge", method: "password" };
  }
}
```

`src/documents/server/domain/access/ports.ts`:

```ts
import type { Result } from "../../../../shared/domain/Result";
import type { DocumentRepositoryError } from "../errors";

export interface DocumentAccessRecord {
  documentId: string;
  /** Null once the protection was removed: nobody can unlock until a new password is set. */
  passwordHash: string | null;
  /** Monotonic; bumped on every set or clear so previous grants stop working. */
  passwordVersion: number;
}

export interface DocumentAccessRepository {
  get(documentId: string): Promise<Result<DocumentRepositoryError, DocumentAccessRecord | null>>;
  /** Upserts the hash (or null) and increments the version. */
  setPasswordHash(
    documentId: string,
    passwordHash: string | null,
    at: Date,
  ): Promise<Result<DocumentRepositoryError, DocumentAccessRecord>>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
}

export interface IssuedGrant {
  token: string;
  expiresAt: Date;
}

export interface AccessGrantCodec {
  cookieName(documentId: string): string;
  issue(input: {
    documentId: string;
    passwordVersion: number;
    now: Date;
    ttlSeconds: number;
  }): IssuedGrant;
  verify(
    token: string,
    input: { documentId: string; passwordVersion: number; now: Date },
  ): boolean;
}

export interface UnlockAttemptStatus {
  blocked: boolean;
  retryAfterSeconds: number;
}

export interface UnlockAttemptLimiter {
  check(
    documentId: string,
    clientKey: string,
    now: Date,
  ): Promise<Result<DocumentRepositoryError, UnlockAttemptStatus>>;
  recordFailure(
    documentId: string,
    clientKey: string,
    now: Date,
  ): Promise<Result<DocumentRepositoryError, void>>;
  reset(documentId: string, clientKey: string): Promise<Result<DocumentRepositoryError, void>>;
}
```

`src/documents/server/domain/errors.ts` — añadir antes de `export type DocumentServiceError`:

```ts
export class InvalidDocumentPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDocumentPasswordError";
  }
}

export class DocumentUnlockFailedError extends Error {
  constructor() {
    super("Contraseña incorrecta");
    this.name = "DocumentUnlockFailedError";
  }
}

export class DocumentUnlockRateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Demasiados intentos. Inténtalo de nuevo más tarde.");
    this.name = "DocumentUnlockRateLimitedError";
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/documents/server/domain/access`
Expected: PASS (4 pruebas).

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/domain/access src/documents/server/domain/errors.ts
git commit -m "feat(documents): política de acceso por contraseña y puertos"
```

---

### Task 3: Hasher scrypt

**Files:**
- Create: `src/documents/server/infraestructure/access/ScryptPasswordHasher.ts`
- Test: `src/documents/server/infraestructure/access/ScryptPasswordHasher.test.ts`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
import { describe, expect, it } from "vitest";

import { ScryptPasswordHasher } from "./ScryptPasswordHasher";

describe("ScryptPasswordHasher", () => {
  const hasher = new ScryptPasswordHasher();

  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hasher.hash("correcta-12345");

    expect(await hasher.verify("correcta-12345", stored)).toBe(true);
    expect(await hasher.verify("incorrecta-1", stored)).toBe(false);
  });

  it("uses a different salt for every hash and a self-describing format", async () => {
    const first = await hasher.hash("misma-clave-1");
    const second = await hasher.hash("misma-clave-1");

    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(first).not.toContain("misma-clave-1");
  });

  it("rejects malformed stored values instead of throwing", async () => {
    expect(await hasher.verify("x", "")).toBe(false);
    expect(await hasher.verify("x", "scrypt$bad")).toBe(false);
    expect(await hasher.verify("x", "bcrypt$a$b$c$d$e")).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/documents/server/infraestructure/access/ScryptPasswordHasher.test.ts`
Expected: FAIL (módulo no encontrado).

- [ ] **Step 3: Implementar**

```ts
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import type { PasswordHasher } from "../../domain/access/ports";

const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, keyLength: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, { N: n, r, p, maxmem: 128 * n * r * 2 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** scrypt hashes encoded as `scrypt$N$r$p$salt$hash` (base64url). */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELISM, KEY_LENGTH);
    return ["scrypt", COST, BLOCK_SIZE, PARALLELISM, salt.toString("base64url"), key.toString("base64url")].join("$");
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltValue, hashValue] = parts;
    const cost = Number(n);
    const block = Number(r);
    const parallelism = Number(p);
    if (![cost, block, parallelism].every((value) => Number.isInteger(value) && value > 0)) return false;

    try {
      const salt = Buffer.from(saltValue, "base64url");
      const expected = Buffer.from(hashValue, "base64url");
      if (salt.length === 0 || expected.length === 0) return false;
      const actual = await derive(password, salt, cost, block, parallelism, expected.length);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/documents/server/infraestructure/access/ScryptPasswordHasher.test.ts`
Expected: PASS (3 pruebas).

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/infraestructure/access/ScryptPasswordHasher.ts src/documents/server/infraestructure/access/ScryptPasswordHasher.test.ts
git commit -m "feat(documents): hasher scrypt para contraseñas de documentos"
```

---

### Task 4: Codec de concesiones HMAC

**Files:**
- Create: `src/documents/server/infraestructure/access/HmacAccessGrantCodec.ts`
- Test: `src/documents/server/infraestructure/access/HmacAccessGrantCodec.test.ts`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
import { describe, expect, it } from "vitest";

import { HmacAccessGrantCodec } from "./HmacAccessGrantCodec";

const now = new Date("2026-11-04T12:00:00.000Z");
const secret = "a-secret-with-more-than-thirty-two-chars";

describe("HmacAccessGrantCodec", () => {
  const codec = new HmacAccessGrantCodec(secret);
  const grant = codec.issue({ documentId: "doc-1", passwordVersion: 2, now, ttlSeconds: 3600 });

  it("accepts a fresh grant for the same document and version", () => {
    expect(codec.verify(grant.token, { documentId: "doc-1", passwordVersion: 2, now })).toBe(true);
    expect(grant.expiresAt).toEqual(new Date("2026-11-04T13:00:00.000Z"));
  });

  it("rejects another document or another password version", () => {
    expect(codec.verify(grant.token, { documentId: "doc-2", passwordVersion: 2, now })).toBe(false);
    expect(codec.verify(grant.token, { documentId: "doc-1", passwordVersion: 3, now })).toBe(false);
  });

  it("rejects an expired grant", () => {
    const later = new Date(now.getTime() + 3601 * 1000);

    expect(codec.verify(grant.token, { documentId: "doc-1", passwordVersion: 2, now: later })).toBe(false);
  });

  it("rejects tampered or malformed tokens", () => {
    const [payload, signature] = grant.token.split(".");
    const forged = Buffer.from(JSON.stringify({ d: "doc-1", v: 2, exp: 99999999999 })).toString("base64url");

    expect(codec.verify(`${payload}.${signature.slice(0, -2)}xx`, { documentId: "doc-1", passwordVersion: 2, now })).toBe(false);
    expect(codec.verify(`${forged}.${signature}`, { documentId: "doc-1", passwordVersion: 2, now })).toBe(false);
    expect(codec.verify("garbage", { documentId: "doc-1", passwordVersion: 2, now })).toBe(false);
    expect(codec.verify("", { documentId: "doc-1", passwordVersion: 2, now })).toBe(false);
  });

  it("does not validate with a different secret", () => {
    const other = new HmacAccessGrantCodec("another-secret-with-more-than-thirty-two");

    expect(other.verify(grant.token, { documentId: "doc-1", passwordVersion: 2, now })).toBe(false);
  });

  it("derives a stable, document-specific cookie name", () => {
    expect(codec.cookieName("doc-1")).toBe(codec.cookieName("doc-1"));
    expect(codec.cookieName("doc-1")).not.toBe(codec.cookieName("doc-2"));
    expect(codec.cookieName("doc-1")).toMatch(/^nbk-grant-[0-9a-f]{16}$/);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/documents/server/infraestructure/access/HmacAccessGrantCodec.test.ts`
Expected: FAIL (módulo no encontrado).

- [ ] **Step 3: Implementar**

```ts
import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import type { AccessGrantCodec, IssuedGrant } from "../../domain/access/ports";

interface GrantPayload {
  d: string;
  v: number;
  exp: number;
}

/**
 * Signs `{ documentId, passwordVersion, exp }` with an HKDF-derived key so the
 * application secret is never used raw for grants.
 */
export class HmacAccessGrantCodec implements AccessGrantCodec {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = Buffer.from(hkdfSync("sha256", secret, "nanobook", "document-access-grant:v1", 32));
  }

  cookieName(documentId: string): string {
    return `nbk-grant-${createHash("sha256").update(documentId).digest("hex").slice(0, 16)}`;
  }

  issue(input: { documentId: string; passwordVersion: number; now: Date; ttlSeconds: number }): IssuedGrant {
    const exp = Math.floor(input.now.getTime() / 1000) + input.ttlSeconds;
    const payload = Buffer.from(
      JSON.stringify({ d: input.documentId, v: input.passwordVersion, exp } satisfies GrantPayload),
    ).toString("base64url");
    return { token: `${payload}.${this.sign(payload)}`, expiresAt: new Date(exp * 1000) };
  }

  verify(token: string, input: { documentId: string; passwordVersion: number; now: Date }): boolean {
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const [payload, signature] = parts;

    const expected = Buffer.from(this.sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;

    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<GrantPayload>;
      return (
        data.d === input.documentId &&
        data.v === input.passwordVersion &&
        typeof data.exp === "number" &&
        data.exp > Math.floor(input.now.getTime() / 1000)
      );
    } catch {
      return false;
    }
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.key).update(payload).digest("base64url");
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/documents/server/infraestructure/access/HmacAccessGrantCodec.test.ts`
Expected: PASS (6 pruebas).

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/infraestructure/access/HmacAccessGrantCodec.ts src/documents/server/infraestructure/access/HmacAccessGrantCodec.test.ts
git commit -m "feat(documents): concesiones de acceso firmadas con HMAC"
```

---

### Task 5: Esquema y migración

**Files:**
- Modify: `src/documents/server/infraestructure/database/DrizzleDocumentSchema.ts`
- Create: `drizzle/0016_document_access.sql` (generado)

- [ ] **Step 1: Añadir las tablas al esquema**

En `DrizzleDocumentSchema.ts`, cambiar el import de `sqlite-core`:

```ts
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
```

y añadir al final del archivo:

```ts
export const documentAccess = sqliteTable("document_access", {
  documentId: text("document_id")
    .primaryKey()
    .references(() => document.id, { onDelete: "cascade" }),
  /** Null after the protection is removed: nobody can unlock. */
  passwordHash: text("password_hash"),
  passwordVersion: integer("password_version").notNull().default(1),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const documentUnlockAttempt = sqliteTable(
  "document_unlock_attempt",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    clientKey: text("client_key").notNull(),
    windowStartedAt: integer("window_started_at", { mode: "timestamp_ms" }).notNull(),
    failures: integer("failures").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.documentId, table.clientKey] })],
);
```

- [ ] **Step 2: Generar la migración**

Run: `npx drizzle-kit generate --name document_access`
Expected: se crea `drizzle/0016_document_access.sql` y se actualiza `drizzle/meta/_journal.json` y un snapshot nuevo.

- [ ] **Step 3: Verificar el SQL generado**

Run: `grep -c "CREATE TABLE" drizzle/0016_document_access.sql`
Expected: `2`

Run: `grep -E "document_access|document_unlock_attempt|ON DELETE cascade|PRIMARY KEY" drizzle/0016_document_access.sql`
Expected: aparecen ambas tablas, sus claves y `ON DELETE cascade`. Si drizzle-kit pregunta por renombrados, responder que son tablas nuevas.

- [ ] **Step 4: Comprobar que el esquema compila**

Run: `npx tsc --noEmit -p . 2>&1 | head -20` (si el proyecto no tiene `tsc` configurado, usar `npm run build`)
Expected: sin errores nuevos relacionados con `DrizzleDocumentSchema.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/infraestructure/database/DrizzleDocumentSchema.ts drizzle/0016_document_access.sql drizzle/meta
git commit -m "feat(documents): tablas document_access y document_unlock_attempt"
```

---

### Task 6: Repositorio de acceso y limitador de intentos

**Files:**
- Create: `src/documents/server/infraestructure/access/DrizzleDocumentAccessRepository.ts`
- Create: `src/documents/server/infraestructure/access/DrizzleUnlockAttemptLimiter.ts`
- Test: `src/documents/server/infraestructure/access/DrizzleAccessPersistence.test.ts`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";

import { createDatabase } from "../../../../shared/infrastructure/database/createDatabase";
import { DEFAULT_ACCESS_GRANT_POLICY } from "../../domain/access/AccessGrantPolicy";
import { DrizzleDocumentAccessRepository } from "./DrizzleDocumentAccessRepository";
import { DrizzleUnlockAttemptLimiter } from "./DrizzleUnlockAttemptLimiter";

describe("document access persistence", () => {
  let connection: ReturnType<typeof createDatabase>;
  let repository: DrizzleDocumentAccessRepository;
  let limiter: DrizzleUnlockAttemptLimiter;
  const at = new Date("2026-11-04T12:00:00.000Z");

  beforeEach(async () => {
    connection = createDatabase({ url: ":memory:" });
    await connection.db.run(sql`PRAGMA foreign_keys = ON`);
    await connection.db.run(sql`CREATE TABLE document (id TEXT PRIMARY KEY)`);
    const migration = readFileSync("drizzle/0016_document_access.sql", "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await connection.client.execute(statement.trim());
    }
    await connection.db.run(sql`INSERT INTO document (id) VALUES ('doc-1'), ('doc-2')`);
    repository = new DrizzleDocumentAccessRepository(connection.db);
    limiter = new DrizzleUnlockAttemptLimiter(connection.db, DEFAULT_ACCESS_GRANT_POLICY);
  });

  afterEach(() => connection.client.close());

  describe("DrizzleDocumentAccessRepository", () => {
    it("returns null when the document has no access record", async () => {
      expect((await repository.get("doc-1")).getValue()).toBeNull();
    });

    it("creates the record at version 1 and bumps it on every change", async () => {
      const first = (await repository.setPasswordHash("doc-1", "hash-a", at)).getValue();
      const second = (await repository.setPasswordHash("doc-1", "hash-b", at)).getValue();
      const cleared = (await repository.setPasswordHash("doc-1", null, at)).getValue();

      expect(first).toEqual({ documentId: "doc-1", passwordHash: "hash-a", passwordVersion: 1 });
      expect(second.passwordVersion).toBe(2);
      expect(second.passwordHash).toBe("hash-b");
      expect(cleared).toEqual({ documentId: "doc-1", passwordHash: null, passwordVersion: 3 });
    });

    it("keeps documents isolated and cascades with the document", async () => {
      await repository.setPasswordHash("doc-1", "hash-a", at);

      expect((await repository.get("doc-2")).getValue()).toBeNull();

      await connection.db.run(sql`DELETE FROM document WHERE id = 'doc-1'`);
      expect((await repository.get("doc-1")).getValue()).toBeNull();
    });
  });

  describe("DrizzleUnlockAttemptLimiter", () => {
    it("blocks after the configured number of failures", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect((await limiter.check("doc-1", "client-a", at)).getValue().blocked).toBe(false);
        await limiter.recordFailure("doc-1", "client-a", at);
      }

      const status = (await limiter.check("doc-1", "client-a", at)).getValue();

      expect(status.blocked).toBe(true);
      expect(status.retryAfterSeconds).toBeGreaterThan(0);
      expect(status.retryAfterSeconds).toBeLessThanOrEqual(900);
    });

    it("isolates clients and documents", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await limiter.recordFailure("doc-1", "client-a", at);
      }

      expect((await limiter.check("doc-1", "client-b", at)).getValue().blocked).toBe(false);
      expect((await limiter.check("doc-2", "client-a", at)).getValue().blocked).toBe(false);
    });

    it("starts a new window once the previous one expired", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await limiter.recordFailure("doc-1", "client-a", at);
      }
      const later = new Date(at.getTime() + 901 * 1000);

      expect((await limiter.check("doc-1", "client-a", later)).getValue().blocked).toBe(false);
      await limiter.recordFailure("doc-1", "client-a", later);
      expect((await limiter.check("doc-1", "client-a", later)).getValue().blocked).toBe(false);
    });

    it("clears the counter after a successful unlock", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await limiter.recordFailure("doc-1", "client-a", at);
      }

      await limiter.reset("doc-1", "client-a");

      expect((await limiter.check("doc-1", "client-a", at)).getValue().blocked).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/documents/server/infraestructure/access/DrizzleAccessPersistence.test.ts`
Expected: FAIL (módulos no encontrados).

- [ ] **Step 3: Implementar**

`DrizzleDocumentAccessRepository.ts`:

```ts
import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Result } from "../../../../shared/domain/Result";
import type { DocumentAccessRecord, DocumentAccessRepository } from "../../domain/access/ports";
import { DocumentRepositoryError } from "../../domain/errors";
import { documentAccess } from "../database/DrizzleDocumentSchema";

type Database = LibSQLDatabase<any>;

export class DrizzleDocumentAccessRepository implements DocumentAccessRepository {
  constructor(private readonly database: Database) {}

  async get(documentId: string) {
    try {
      const [row] = await this.database
        .select()
        .from(documentAccess)
        .where(eq(documentAccess.documentId, documentId))
        .limit(1);
      return Result.ok<DocumentAccessRecord | null>(
        row
          ? { documentId: row.documentId, passwordHash: row.passwordHash, passwordVersion: row.passwordVersion }
          : null,
      );
    } catch (error) {
      return Result.fail(new DocumentRepositoryError("No fue posible consultar el acceso del documento", { cause: error }));
    }
  }

  async setPasswordHash(documentId: string, passwordHash: string | null, at: Date) {
    try {
      await this.database
        .insert(documentAccess)
        .values({ documentId, passwordHash, passwordVersion: 1, updatedAt: at })
        .onConflictDoUpdate({
          target: documentAccess.documentId,
          set: {
            passwordHash,
            passwordVersion: sql`${documentAccess.passwordVersion} + 1`,
            updatedAt: at,
          },
        });
    } catch (error) {
      return Result.fail(new DocumentRepositoryError("No fue posible guardar el acceso del documento", { cause: error }));
    }

    const stored = await this.get(documentId);
    if (!stored.isSuccess) return Result.fail(stored.getError());
    const record = stored.getValue();
    if (!record) {
      return Result.fail(new DocumentRepositoryError("El acceso del documento no se persistió"));
    }
    return Result.ok(record);
  }
}
```

`DrizzleUnlockAttemptLimiter.ts`:

```ts
import { and, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Result } from "../../../../shared/domain/Result";
import type { AccessGrantPolicy } from "../../domain/access/AccessGrantPolicy";
import type { UnlockAttemptLimiter, UnlockAttemptStatus } from "../../domain/access/ports";
import { DocumentRepositoryError } from "../../domain/errors";
import { documentUnlockAttempt as attempts } from "../database/DrizzleDocumentSchema";

type Database = LibSQLDatabase<any>;

export class DrizzleUnlockAttemptLimiter implements UnlockAttemptLimiter {
  constructor(
    private readonly database: Database,
    private readonly policy: Pick<AccessGrantPolicy, "maxFailures" | "failureWindowSeconds">,
  ) {}

  async check(documentId: string, clientKey: string, now: Date) {
    try {
      const [row] = await this.database
        .select()
        .from(attempts)
        .where(and(eq(attempts.documentId, documentId), eq(attempts.clientKey, clientKey)))
        .limit(1);
      const windowEnd = row ? row.windowStartedAt.getTime() + this.policy.failureWindowSeconds * 1000 : 0;
      if (!row || windowEnd <= now.getTime() || row.failures < this.policy.maxFailures) {
        return Result.ok<UnlockAttemptStatus>({ blocked: false, retryAfterSeconds: 0 });
      }
      return Result.ok<UnlockAttemptStatus>({
        blocked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000)),
      });
    } catch (error) {
      return Result.fail(new DocumentRepositoryError("No fue posible comprobar los intentos de desbloqueo", { cause: error }));
    }
  }

  async recordFailure(documentId: string, clientKey: string, now: Date) {
    const floor = now.getTime() - this.policy.failureWindowSeconds * 1000;
    const nowMs = now.getTime();
    try {
      await this.database
        .insert(attempts)
        .values({ documentId, clientKey, windowStartedAt: now, failures: 1 })
        .onConflictDoUpdate({
          target: [attempts.documentId, attempts.clientKey],
          set: {
            failures: sql`CASE WHEN ${attempts.windowStartedAt} <= ${floor} THEN 1 ELSE ${attempts.failures} + 1 END`,
            windowStartedAt: sql`CASE WHEN ${attempts.windowStartedAt} <= ${floor} THEN ${nowMs} ELSE ${attempts.windowStartedAt} END`,
          },
        });
      return Result.ok();
    } catch (error) {
      return Result.fail(new DocumentRepositoryError("No fue posible registrar el intento fallido", { cause: error }));
    }
  }

  async reset(documentId: string, clientKey: string) {
    try {
      await this.database
        .delete(attempts)
        .where(and(eq(attempts.documentId, documentId), eq(attempts.clientKey, clientKey)));
      return Result.ok();
    } catch (error) {
      return Result.fail(new DocumentRepositoryError("No fue posible reiniciar los intentos", { cause: error }));
    }
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/documents/server/infraestructure/access/DrizzleAccessPersistence.test.ts`
Expected: PASS (7 pruebas). Si falla la comparación de la ventana, verificar que `windowStartedAt` se almacena en milisegundos (`mode: "timestamp_ms"`).

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/infraestructure/access/DrizzleDocumentAccessRepository.ts src/documents/server/infraestructure/access/DrizzleUnlockAttemptLimiter.ts src/documents/server/infraestructure/access/DrizzleAccessPersistence.test.ts
git commit -m "feat(documents): persistencia de acceso y limitador de intentos"
```

---

### Task 7: Casos de uso `SetDocumentPassword` y `ClearDocumentPassword`

**Files:**
- Create: `src/documents/server/application/access/testDoubles.ts`
- Create: `src/documents/server/application/access/loadOwnedDocument.ts`
- Create: `src/documents/server/application/access/SetDocumentPassword.ts`
- Create: `src/documents/server/application/access/ClearDocumentPassword.ts`
- Test: `src/documents/server/application/access/DocumentPasswordAdmin.test.ts`

- [ ] **Step 1: Crear los dobles de prueba**

`testDoubles.ts`:

```ts
import { Result } from "../../../../shared/domain/Result";
import type {
  AccessGrantCodec,
  DocumentAccessRecord,
  DocumentAccessRepository,
  PasswordHasher,
  UnlockAttemptLimiter,
  UnlockAttemptStatus,
} from "../../domain/access/ports";

export class InMemoryAccessRepository implements DocumentAccessRepository {
  readonly records = new Map<string, DocumentAccessRecord>();

  async get(documentId: string) {
    return Result.ok(this.records.get(documentId) ?? null);
  }

  async setPasswordHash(documentId: string, passwordHash: string | null) {
    const version = (this.records.get(documentId)?.passwordVersion ?? 0) + 1;
    const record = { documentId, passwordHash, passwordVersion: version };
    this.records.set(documentId, record);
    return Result.ok(record);
  }
}

export class FakeHasher implements PasswordHasher {
  async hash(password: string) {
    return `hash:${password}`;
  }
  async verify(password: string, stored: string) {
    return stored === `hash:${password}`;
  }
}

export class FakeCodec implements AccessGrantCodec {
  cookieName(documentId: string) {
    return `grant-${documentId}`;
  }
  issue(input: { documentId: string; passwordVersion: number; now: Date; ttlSeconds: number }) {
    return {
      token: `${input.documentId}:${input.passwordVersion}`,
      expiresAt: new Date(input.now.getTime() + input.ttlSeconds * 1000),
    };
  }
  verify(token: string, input: { documentId: string; passwordVersion: number }) {
    return token === `${input.documentId}:${input.passwordVersion}`;
  }
}

export class FakeLimiter implements UnlockAttemptLimiter {
  failures = 0;
  blockedFor = 0;
  async check(): Promise<Result<never, UnlockAttemptStatus>> {
    return Result.ok({ blocked: this.blockedFor > 0, retryAfterSeconds: this.blockedFor });
  }
  async recordFailure() {
    this.failures += 1;
    return Result.ok();
  }
  async reset() {
    this.failures = 0;
    return Result.ok();
  }
}
```

- [ ] **Step 2: Escribir la prueba que falla**

`DocumentPasswordAdmin.test.ts`:

```ts
import { describe, expect, it, vi, type Mock } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import { DocumentAccessDeniedError, DocumentNotFoundError, InvalidDocumentPasswordError } from "../../domain/errors";
import { createEventBus, createRepository } from "../test/factories";
import { ClearDocumentPassword } from "./ClearDocumentPassword";
import { SetDocumentPassword } from "./SetDocumentPassword";
import { FakeHasher, InMemoryAccessRepository } from "./testDoubles";

function document(secured = false) {
  return Document.create(
    "guia",
    {
      id: "doc-1",
      title: "Guía",
      description: "Descripción",
      author: "Autora",
      ownerId: "owner-1",
      secured,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    "# Guía",
    null,
    undefined,
    undefined,
    5,
  ).getValue();
}

function setup(existing: Document | null) {
  const contentRepository = createRepository({
    getByPublicPath: vi.fn().mockResolvedValue(Result.ok(existing)),
  });
  const accessRepository = new InMemoryAccessRepository();
  const eventBus = createEventBus();
  return { contentRepository, accessRepository, eventBus };
}

describe("SetDocumentPassword", () => {
  it("hashes the password, stores it and marks the document as secured", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document());

    const result = await new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus).execute(
      "book-a",
      "guia",
      "una-clave-segura",
      "owner-1",
    );

    expect(result.isSuccess).toBe(true);
    expect(accessRepository.records.get("doc-1")).toMatchObject({ passwordHash: "hash:una-clave-segura", passwordVersion: 1 });
    const updates = (contentRepository.updateMany as Mock).mock.calls[0][1];
    expect(updates[0].document.getMetadata().secured).toBe(true);
    expect(updates[0].expectedRevision).toBe(5);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it("bumps the version when the password changes", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document(true));
    const useCase = new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus);

    await useCase.execute("book-a", "guia", "primera-clave-1", "owner-1");
    await useCase.execute("book-a", "guia", "segunda-clave-2", "owner-1");

    expect(accessRepository.records.get("doc-1")?.passwordVersion).toBe(2);
  });

  it.each(["corta", "x".repeat(129), "   "])("rejects an invalid password (%s)", async (password) => {
    const { contentRepository, accessRepository, eventBus } = setup(document());

    const result = await new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus).execute(
      "book-a",
      "guia",
      password,
      "owner-1",
    );

    expect(result.getError()).toBeInstanceOf(InvalidDocumentPasswordError);
    expect(accessRepository.records.size).toBe(0);
  });

  it("rejects actors that do not own the document", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document());

    const result = await new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus).execute(
      "book-a",
      "guia",
      "una-clave-segura",
      "intruder",
    );

    expect(result.getError()).toBeInstanceOf(DocumentAccessDeniedError);
    expect(accessRepository.records.size).toBe(0);
  });

  it("fails when the document does not exist", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(null);

    const result = await new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus).execute(
      "book-a",
      "missing",
      "una-clave-segura",
      "owner-1",
    );

    expect(result.getError()).toBeInstanceOf(DocumentNotFoundError);
  });
});

describe("ClearDocumentPassword", () => {
  it("removes the hash, bumps the version and unmarks the document", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document(true));
    await accessRepository.setPasswordHash("doc-1", "hash:vieja-clave-1", new Date());

    const result = await new ClearDocumentPassword(contentRepository, accessRepository, eventBus).execute(
      "book-a",
      "guia",
      "owner-1",
    );

    expect(result.isSuccess).toBe(true);
    expect(accessRepository.records.get("doc-1")).toMatchObject({ passwordHash: null, passwordVersion: 2 });
    const updates = (contentRepository.updateMany as Mock).mock.calls[0][1];
    expect(updates[0].document.getMetadata().secured).toBeUndefined();
  });

  it("is a no-op for documents that are not secured", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document(false));

    const result = await new ClearDocumentPassword(contentRepository, accessRepository, eventBus).execute(
      "book-a",
      "guia",
      "owner-1",
    );

    expect(result.isSuccess).toBe(true);
    expect(accessRepository.records.size).toBe(0);
    expect(contentRepository.updateMany).not.toHaveBeenCalled();
  });

  it("rejects actors that do not own the document", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document(true));

    const result = await new ClearDocumentPassword(contentRepository, accessRepository, eventBus).execute(
      "book-a",
      "guia",
      "intruder",
    );

    expect(result.getError()).toBeInstanceOf(DocumentAccessDeniedError);
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npx vitest run src/documents/server/application/access/DocumentPasswordAdmin.test.ts`
Expected: FAIL (módulos no encontrados).

- [ ] **Step 4: Implementar**

`loadOwnedDocument.ts`:

```ts
import { Result } from "../../../../shared/domain/Result";
import type { Document } from "../../domain/Document";
import { DocumentPath } from "../../domain/DocumentPath";
import { DocumentAccessDeniedError, DocumentNotFoundError, type InvalidDocumentError } from "../../domain/errors";
import type { ContentRepository, ContentRepositoryListError } from "../../domain/ports/ContentRepository";

export type LoadOwnedDocumentError =
  | ContentRepositoryListError
  | DocumentNotFoundError
  | DocumentAccessDeniedError
  | InvalidDocumentError;

/** Loads a document by public path and requires the actor to own it. */
export async function loadOwnedDocument(
  contentRepository: ContentRepository,
  nanobookId: string,
  documentPath: string,
  actorId: string,
): Promise<Result<LoadOwnedDocumentError, Document>> {
  const pathResult = DocumentPath.create(documentPath);
  if (!pathResult.isSuccess) return Result.fail(new DocumentNotFoundError(documentPath));

  const found = await contentRepository.getByPublicPath(nanobookId, pathResult.getValue().getPublicValue());
  if (!found.isSuccess) return Result.fail(found.getError());

  const document = found.getValue();
  if (!document) return Result.fail(new DocumentNotFoundError(documentPath));
  if (document.getMetadata().ownerId !== actorId) {
    return Result.fail(new DocumentAccessDeniedError(document.getDocumentId().getValue()));
  }
  return Result.ok(document);
}
```

`SetDocumentPassword.ts`:

```ts
import { Result } from "../../../../shared/domain/Result";
import type { EventBus } from "../../../../shared/domain/bus/EventBus";
import type { EventBusError } from "../../../../shared/domain/bus/errors";
import type { DocumentAccessRepository, PasswordHasher } from "../../domain/access/ports";
import { InvalidDocumentPasswordError } from "../../domain/errors";
import { DocumentUpdated } from "../../domain/events/DocumentUpdated";
import type { ContentRepository, ContentRepositoryError } from "../../domain/ports/ContentRepository";
import type { DocumentRepositoryError, InvalidDocumentError, InvalidDocumentIdError } from "../../domain/errors";
import { loadOwnedDocument, type LoadOwnedDocumentError } from "./loadOwnedDocument";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export type DocumentAccessAdminError =
  | LoadOwnedDocumentError
  | InvalidDocumentPasswordError
  | DocumentRepositoryError
  | ContentRepositoryError
  | InvalidDocumentIdError
  | InvalidDocumentError
  | EventBusError;

export class SetDocumentPassword {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly accessRepository: DocumentAccessRepository,
    private readonly hasher: PasswordHasher,
    private readonly eventBus: EventBus,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    nanobookId: string,
    documentPath: string,
    password: string,
    actorId: string,
  ): Promise<Result<DocumentAccessAdminError, void>> {
    if (
      password.trim().length === 0 ||
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return Result.fail(
        new InvalidDocumentPasswordError(
          `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres`,
        ),
      );
    }

    const loaded = await loadOwnedDocument(this.contentRepository, nanobookId, documentPath, actorId);
    if (!loaded.isSuccess) return Result.fail(loaded.getError());
    const document = loaded.getValue();
    const documentId = document.getDocumentId().getValue();
    const now = this.clock();

    const stored = await this.accessRepository.setPasswordHash(documentId, await this.hasher.hash(password), now);
    if (!stored.isSuccess) return Result.fail(stored.getError());

    const secured = document.withSecured(true, now);
    if (!secured.isSuccess) return Result.fail(secured.getError());
    const updated = await this.contentRepository.updateMany(nanobookId, [
      { document: secured.getValue(), expectedRevision: document.getRevision() },
    ]);
    if (!updated.isSuccess) return Result.fail(updated.getError());

    const published = await this.eventBus.publish(new DocumentUpdated(documentId, nanobookId));
    if (!published.isSuccess) return Result.fail(published.getError());
    return Result.ok();
  }
}
```

`ClearDocumentPassword.ts`:

```ts
import { Result } from "../../../../shared/domain/Result";
import type { EventBus } from "../../../../shared/domain/bus/EventBus";
import type { DocumentAccessRepository } from "../../domain/access/ports";
import { DocumentUpdated } from "../../domain/events/DocumentUpdated";
import type { ContentRepository } from "../../domain/ports/ContentRepository";
import { loadOwnedDocument } from "./loadOwnedDocument";
import type { DocumentAccessAdminError } from "./SetDocumentPassword";

export class ClearDocumentPassword {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly accessRepository: DocumentAccessRepository,
    private readonly eventBus: EventBus,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    nanobookId: string,
    documentPath: string,
    actorId: string,
  ): Promise<Result<DocumentAccessAdminError, void>> {
    const loaded = await loadOwnedDocument(this.contentRepository, nanobookId, documentPath, actorId);
    if (!loaded.isSuccess) return Result.fail(loaded.getError());
    const document = loaded.getValue();
    if (document.getMetadata().secured !== true) return Result.ok();

    const documentId = document.getDocumentId().getValue();
    const now = this.clock();

    // Bump the version first: any grant issued before this point is revoked.
    const cleared = await this.accessRepository.setPasswordHash(documentId, null, now);
    if (!cleared.isSuccess) return Result.fail(cleared.getError());

    const open = document.withSecured(false, now);
    if (!open.isSuccess) return Result.fail(open.getError());
    const updated = await this.contentRepository.updateMany(nanobookId, [
      { document: open.getValue(), expectedRevision: document.getRevision() },
    ]);
    if (!updated.isSuccess) return Result.fail(updated.getError());

    const published = await this.eventBus.publish(new DocumentUpdated(documentId, nanobookId));
    if (!published.isSuccess) return Result.fail(published.getError());
    return Result.ok();
  }
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npx vitest run src/documents/server/application/access/DocumentPasswordAdmin.test.ts`
Expected: PASS (10 pruebas, contando las tres de `it.each`).

- [ ] **Step 6: Commit**

```bash
git add src/documents/server/application/access
git commit -m "feat(documents): casos de uso para fijar y quitar la contraseña"
```

---

### Task 8: `AuthorizeDocumentAccess` y `UnlockDocument`

**Files:**
- Create: `src/documents/server/application/access/readCookie.ts`
- Create: `src/documents/server/application/access/AuthorizeDocumentAccess.ts`
- Create: `src/documents/server/application/access/UnlockDocument.ts`
- Test: `src/documents/server/application/access/AuthorizeAndUnlock.test.ts`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
import { describe, expect, it, vi } from "vitest";

import { Document } from "../../domain/Document";
import { DEFAULT_ACCESS_GRANT_POLICY } from "../../domain/access/AccessGrantPolicy";
import { PasswordAccessPolicy } from "../../domain/access/DocumentAccessPolicy";
import {
  DocumentNotFoundError,
  DocumentUnlockFailedError,
  DocumentUnlockRateLimitedError,
} from "../../domain/errors";
import { AuthorizeDocumentAccess } from "./AuthorizeDocumentAccess";
import { readCookie } from "./readCookie";
import { FakeCodec, FakeHasher, FakeLimiter, InMemoryAccessRepository } from "./testDoubles";
import { UnlockDocument } from "./UnlockDocument";

const now = new Date("2026-11-04T12:00:00.000Z");

function document(id: string, secured: boolean, path = "guia") {
  return Document.create(
    path,
    {
      id,
      title: id,
      description: "Descripción",
      author: "Autora",
      ownerId: "owner-1",
      secured,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    "# Secreto",
  ).getValue();
}

describe("readCookie", () => {
  it("reads a value from a cookie header", () => {
    expect(readCookie("a=1; b=two; c=3", "b")).toBe("two");
    expect(readCookie("a=1", "missing")).toBeUndefined();
    expect(readCookie(null, "a")).toBeUndefined();
  });
});

describe("AuthorizeDocumentAccess", () => {
  async function setup() {
    const accessRepository = new InMemoryAccessRepository();
    await accessRepository.setPasswordHash("doc-1", "hash:clave-correcta", now);
    const authorize = new AuthorizeDocumentAccess(accessRepository, new FakeCodec(), new PasswordAccessPolicy(), () => now);
    return { accessRepository, authorize };
  }

  it("allows documents that are not secured", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({ documents: [document("doc-2", false)], canWrite: false, cookieHeader: null });

    expect(decision).toEqual({ kind: "allow" });
  });

  it("allows writers without a cookie", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({ documents: [document("doc-1", true)], canWrite: true, cookieHeader: null });

    expect(decision.kind).toBe("allow");
  });

  it("challenges readers without a grant", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({ documents: [document("doc-1", true)], canWrite: false, cookieHeader: null });

    expect(decision).toEqual({ kind: "challenge", method: "password" });
  });

  it("allows readers holding a valid grant", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({
      documents: [document("doc-1", true)],
      canWrite: false,
      cookieHeader: "x=1; grant-doc-1=doc-1:1",
    });

    expect(decision.kind).toBe("allow");
  });

  it("rejects a grant from an older password version", async () => {
    const { authorize, accessRepository } = await setup();
    await accessRepository.setPasswordHash("doc-1", "hash:otra-clave-nueva", now);

    const decision = await authorize.execute({
      documents: [document("doc-1", true)],
      canWrite: false,
      cookieHeader: "grant-doc-1=doc-1:1",
    });

    expect(decision.kind).toBe("challenge");
  });

  it("fails closed when a secured document has no password hash", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({
      documents: [document("doc-9", true)],
      canWrite: false,
      cookieHeader: "grant-doc-9=doc-9:1",
    });

    expect(decision.kind).toBe("challenge");
  });

  it("requires a grant for every protected link of the proxy chain", async () => {
    const { authorize, accessRepository } = await setup();
    await accessRepository.setPasswordHash("target-1", "hash:clave-destino", now);
    const raw = document("doc-1", true);
    const resolved = document("target-1", true);

    const onlySource = await authorize.execute({
      documents: [raw, resolved],
      canWrite: false,
      cookieHeader: "grant-doc-1=doc-1:1",
    });
    const both = await authorize.execute({
      documents: [raw, resolved],
      canWrite: false,
      cookieHeader: "grant-doc-1=doc-1:1; grant-target-1=target-1:1",
    });

    expect(onlySource.kind).toBe("challenge");
    expect(both.kind).toBe("allow");
  });

  it("ignores missing documents", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({ documents: [null, undefined], canWrite: false, cookieHeader: null });

    expect(decision.kind).toBe("allow");
  });
});

describe("UnlockDocument", () => {
  async function setup(options: { raw?: Document | null; resolved?: Document | null } = {}) {
    const accessRepository = new InMemoryAccessRepository();
    await accessRepository.setPasswordHash("doc-1", "hash:clave-correcta", now);
    const limiter = new FakeLimiter();
    const raw = options.raw === undefined ? document("doc-1", true) : options.raw;
    const resolved = options.resolved === undefined ? raw : options.resolved;
    const getDocument = {
      executeRaw: vi.fn().mockResolvedValue(raw),
      execute: vi.fn().mockResolvedValue(resolved),
    };
    const unlock = new UnlockDocument(
      getDocument as never,
      accessRepository,
      new FakeHasher(),
      limiter,
      new FakeCodec(),
      DEFAULT_ACCESS_GRANT_POLICY,
      () => now,
    );
    return { accessRepository, limiter, unlock };
  }

  const input = { nanobookId: "book-a", documentPath: "guia", clientKey: "client-a" };

  it("issues a grant for the right password and resets the counter", async () => {
    const { unlock, limiter } = await setup();
    limiter.failures = 3;

    const result = await unlock.execute({ ...input, password: "clave-correcta" });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual({
      cookieName: "grant-doc-1",
      token: "doc-1:1",
      maxAgeSeconds: DEFAULT_ACCESS_GRANT_POLICY.ttlSeconds,
    });
    expect(limiter.failures).toBe(0);
  });

  it("fails with a generic error and records the failure for a wrong password", async () => {
    const { unlock, limiter } = await setup();

    const result = await unlock.execute({ ...input, password: "equivocada" });

    expect(result.getError()).toBeInstanceOf(DocumentUnlockFailedError);
    expect(limiter.failures).toBe(1);
  });

  it("refuses when the client is rate limited, without checking the password", async () => {
    const { unlock, limiter } = await setup();
    limiter.blockedFor = 600;

    const result = await unlock.execute({ ...input, password: "clave-correcta" });

    const error = result.getError();
    expect(error).toBeInstanceOf(DocumentUnlockRateLimitedError);
    expect((error as DocumentUnlockRateLimitedError).retryAfterSeconds).toBe(600);
  });

  it("answers not found for missing or unsecured documents", async () => {
    const missing = await (await setup({ raw: null, resolved: null })).unlock.execute({ ...input, password: "clave-correcta" });
    const open = await (await setup({ raw: document("doc-1", false) })).unlock.execute({ ...input, password: "clave-correcta" });

    expect(missing.getError()).toBeInstanceOf(DocumentNotFoundError);
    expect(open.getError()).toBeInstanceOf(DocumentNotFoundError);
  });

  it("cannot unlock a document whose protection was cleared", async () => {
    const { unlock, accessRepository } = await setup();
    await accessRepository.setPasswordHash("doc-1", null, now);

    const result = await unlock.execute({ ...input, password: "clave-correcta" });

    expect(result.getError()).toBeInstanceOf(DocumentUnlockFailedError);
  });

  it("unlocks whichever link of the proxy chain matches the password", async () => {
    const accessRepository = new InMemoryAccessRepository();
    await accessRepository.setPasswordHash("doc-1", "hash:clave-origen", now);
    await accessRepository.setPasswordHash("target-1", "hash:clave-destino", now);
    const getDocument = {
      executeRaw: vi.fn().mockResolvedValue(document("doc-1", true)),
      execute: vi.fn().mockResolvedValue(document("target-1", true)),
    };
    const unlock = new UnlockDocument(
      getDocument as never,
      accessRepository,
      new FakeHasher(),
      new FakeLimiter(),
      new FakeCodec(),
      DEFAULT_ACCESS_GRANT_POLICY,
      () => now,
    );

    const result = await unlock.execute({ ...input, password: "clave-destino" });

    expect(result.getValue().cookieName).toBe("grant-target-1");
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/documents/server/application/access/AuthorizeAndUnlock.test.ts`
Expected: FAIL (módulos no encontrados).

- [ ] **Step 3: Implementar**

`readCookie.ts`:

```ts
/** Reads one cookie value from a `Cookie` request header. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}
```

`AuthorizeDocumentAccess.ts`:

```ts
import type { Document } from "../../domain/Document";
import type { AccessDecision, DocumentAccessPolicy } from "../../domain/access/DocumentAccessPolicy";
import type { AccessGrantCodec, DocumentAccessRepository } from "../../domain/access/ports";
import { readCookie } from "./readCookie";

export interface AuthorizeDocumentAccessInput {
  /** The proxy chain: the stored document and, when different, the resolved one. */
  documents: Array<Document | null | undefined>;
  canWrite: boolean;
  cookieHeader: string | null;
}

/** Returns the protected links of a chain, deduplicated by identity. */
export function securedDocuments(documents: Array<Document | null | undefined>): Document[] {
  const seen = new Set<string>();
  const secured: Document[] = [];
  for (const document of documents) {
    if (!document || document.getMetadata().secured !== true) continue;
    const id = document.getDocumentId().getValue();
    if (seen.has(id)) continue;
    seen.add(id);
    secured.push(document);
  }
  return secured;
}

export class AuthorizeDocumentAccess {
  constructor(
    private readonly accessRepository: DocumentAccessRepository,
    private readonly codec: AccessGrantCodec,
    private readonly policy: DocumentAccessPolicy,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute({ documents, canWrite, cookieHeader }: AuthorizeDocumentAccessInput): Promise<AccessDecision> {
    const secured = securedDocuments(documents);
    if (secured.length === 0 || canWrite) {
      return this.policy.evaluate({ secured: secured.length > 0, canWrite, hasValidGrant: false });
    }

    for (const document of secured) {
      const hasValidGrant = await this.hasValidGrant(document.getDocumentId().getValue(), cookieHeader);
      const decision = this.policy.evaluate({ secured: true, canWrite: false, hasValidGrant });
      if (decision.kind === "challenge") return decision;
    }
    return { kind: "allow" };
  }

  private async hasValidGrant(documentId: string, cookieHeader: string | null): Promise<boolean> {
    const token = readCookie(cookieHeader, this.codec.cookieName(documentId));
    if (!token) return false;

    const record = await this.accessRepository.get(documentId);
    // A failing lookup or a missing/cleared hash never grants access.
    if (!record.isSuccess) return false;
    const value = record.getValue();
    if (!value || value.passwordHash === null) return false;

    return this.codec.verify(token, {
      documentId,
      passwordVersion: value.passwordVersion,
      now: this.clock(),
    });
  }
}
```

`UnlockDocument.ts`:

```ts
import { Result } from "../../../../shared/domain/Result";
import type { AccessGrantPolicy } from "../../domain/access/AccessGrantPolicy";
import type {
  AccessGrantCodec,
  DocumentAccessRepository,
  PasswordHasher,
  UnlockAttemptLimiter,
} from "../../domain/access/ports";
import {
  DocumentNotFoundError,
  DocumentUnlockFailedError,
  DocumentUnlockRateLimitedError,
  type DocumentRepositoryError,
} from "../../domain/errors";
import type { GetDocument } from "../GetDocument";
import { securedDocuments } from "./AuthorizeDocumentAccess";

export interface UnlockDocumentInput {
  nanobookId: string;
  documentPath: string;
  password: string;
  /** Stable, privacy-preserving identifier of the caller used for rate limiting. */
  clientKey: string;
}

export interface UnlockGrant {
  cookieName: string;
  token: string;
  maxAgeSeconds: number;
}

export type UnlockDocumentError =
  | DocumentNotFoundError
  | DocumentUnlockFailedError
  | DocumentUnlockRateLimitedError
  | DocumentRepositoryError;

export class UnlockDocument {
  constructor(
    private readonly getDocument: Pick<GetDocument, "execute" | "executeRaw">,
    private readonly accessRepository: DocumentAccessRepository,
    private readonly hasher: PasswordHasher,
    private readonly limiter: UnlockAttemptLimiter,
    private readonly codec: AccessGrantCodec,
    private readonly policy: AccessGrantPolicy,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: UnlockDocumentInput): Promise<Result<UnlockDocumentError, UnlockGrant>> {
    const raw = await this.getDocument.executeRaw(input.nanobookId, input.documentPath);
    const resolved = await this.getDocument.execute(input.nanobookId, input.documentPath);
    const chain = securedDocuments([raw, resolved]);
    if (chain.length === 0) return Result.fail(new DocumentNotFoundError(input.documentPath));

    const now = this.clock();
    // Attempts are counted against the requested document, not the chain link.
    const limiterId = (raw ?? resolved)!.getDocumentId().getValue();

    const status = await this.limiter.check(limiterId, input.clientKey, now);
    if (!status.isSuccess) return Result.fail(status.getError());
    if (status.getValue().blocked) {
      return Result.fail(new DocumentUnlockRateLimitedError(status.getValue().retryAfterSeconds));
    }

    for (const document of chain) {
      const documentId = document.getDocumentId().getValue();
      const stored = await this.accessRepository.get(documentId);
      if (!stored.isSuccess) return Result.fail(stored.getError());
      const record = stored.getValue();
      if (!record || record.passwordHash === null) continue;

      if (await this.hasher.verify(input.password, record.passwordHash)) {
        await this.limiter.reset(limiterId, input.clientKey);
        const grant = this.codec.issue({
          documentId,
          passwordVersion: record.passwordVersion,
          now,
          ttlSeconds: this.policy.ttlSeconds,
        });
        return Result.ok({
          cookieName: this.codec.cookieName(documentId),
          token: grant.token,
          maxAgeSeconds: this.policy.ttlSeconds,
        });
      }
    }

    const recorded = await this.limiter.recordFailure(limiterId, input.clientKey, now);
    if (!recorded.isSuccess) return Result.fail(recorded.getError());
    return Result.fail(new DocumentUnlockFailedError());
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/documents/server/application/access`
Expected: PASS (todas las pruebas de `access/`).

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/application/access
git commit -m "feat(documents): evaluación de acceso y desbloqueo con contraseña"
```

---

### Task 9: Comportamiento de proxies (prueba de caracterización)

`ProxyParser` ya fusiona los metadatos del destino, incluida su identidad, sobre el proxy. Esta tarea fija ese comportamiento con una prueba, porque la protección de proxies depende de él.

**Files:**
- Test: `src/documents/server/application/ProxyParser.secured.test.ts`

- [ ] **Step 1: Escribir la prueba**

```ts
import { describe, expect, it } from "vitest";

import { Document } from "../domain/Document";
import type { ContentEntry } from "../domain/types";
import type { ReferenceResolver } from "../domain/reference/types";
import { DocumentId } from "../domain/DocumentId";
import { ProxyParser } from "./ProxyParser";

describe("ProxyParser and protected targets", () => {
  it("makes the resolved proxy inherit the identity and protection of its target", async () => {
    const source = Document.create(
      "atajo",
      {
        id: "source-id",
        title: "Atajo",
        description: "Proxy",
        author: "Autora",
        ownerId: "owner-1",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
        ref: "./secreto",
      },
      "",
    ).getValue();
    const target: ContentEntry = {
      id: DocumentId.create("target-id").getValue(),
      data: {
        id: "target-id",
        title: "Secreto",
        description: "Contenido",
        author: "Autora",
        ownerId: "owner-1",
        secured: true,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
      body: "# Reservado",
    };
    const resolver: ReferenceResolver = { resolve: async () => target };

    const resolved = await new ProxyParser(resolver).parseProxy("book-a", source);

    expect(resolved?.getMetadata().secured).toBe(true);
    expect(resolved?.getDocumentId().getValue()).toBe("target-id");
    expect(resolved?.getContent()).toBe("# Reservado");
  });
});
```

- [ ] **Step 2: Ejecutar**

Run: `npx vitest run src/documents/server/application/ProxyParser.secured.test.ts`
Expected: PASS sin cambios de producción (la fusión `...targetData` ya transmite `id` y `secured`).

Si falla porque `DocumentId.create` o el tipo de `ContentEntry.id` difieren, ajustar solo el doble de prueba para que compile; **no** cambiar `ProxyParser`. Si el resultado no hereda `secured`/identidad, detenerse y revisar con la persona responsable antes de seguir: la protección de proxies de este plan asume ese comportamiento.

- [ ] **Step 3: Commit**

```bash
git add src/documents/server/application/ProxyParser.secured.test.ts
git commit -m "test(documents): caracteriza proxies hacia documentos protegidos"
```

---

### Task 10: Controladores, rutas y composición

**Files:**
- Create: `src/documents/server/infraestructure/rest/DocumentAccessAdminController.ts`
- Create: `src/documents/server/infraestructure/rest/UnlockDocumentController.ts`
- Create: `src/pages/api/nanobooks/[nanobookId]/document-access/index.ts`
- Create: `src/pages/api/nanobooks/[nanobookId]/document-access/unlock.ts`
- Modify: `src/documents/server/index.ts`
- Test: `src/documents/server/infraestructure/rest/DocumentAccessControllers.test.ts`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import type { ClearDocumentPassword } from "../../application/access/ClearDocumentPassword";
import type { SetDocumentPassword } from "../../application/access/SetDocumentPassword";
import type { UnlockDocument } from "../../application/access/UnlockDocument";
import {
  DocumentAccessDeniedError,
  DocumentNotFoundError,
  DocumentUnlockFailedError,
  DocumentUnlockRateLimitedError,
  InvalidDocumentPasswordError,
} from "../../domain/errors";
import { DocumentAccessAdminController } from "./DocumentAccessAdminController";
import { UnlockDocumentController } from "./UnlockDocumentController";

function request(method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://nanobook.test/api/nanobooks/book-a/document-access", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("DocumentAccessAdminController", () => {
  function setup(set = vi.fn(), clear = vi.fn()) {
    return {
      set,
      clear,
      controller: new DocumentAccessAdminController(
        { execute: set } as unknown as SetDocumentPassword,
        { execute: clear } as unknown as ClearDocumentPassword,
      ),
    };
  }

  it("sets a password for the signed-in actor", async () => {
    const { controller, set } = setup(vi.fn().mockResolvedValue(Result.ok()));

    const response = await controller.put({
      params: { nanobookId: "book-a" },
      request: request("PUT", { path: "guia", password: "una-clave-segura" }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ secured: true });
    expect(set).toHaveBeenCalledWith("book-a", "guia", "una-clave-segura", "owner-1");
  });

  it("requires an authenticated actor and a path", async () => {
    const { controller } = setup();

    const anonymous = await controller.put({
      params: { nanobookId: "book-a" },
      request: request("PUT", { path: "guia", password: "una-clave-segura" }),
      locals: {},
    } as never);
    const missingPath = await controller.put({
      params: { nanobookId: "book-a" },
      request: request("PUT", { password: "una-clave-segura" }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(anonymous.status).toBe(401);
    expect(missingPath.status).toBe(400);
  });

  it.each([
    [new InvalidDocumentPasswordError("corta"), 400],
    [new DocumentNotFoundError("guia"), 404],
    [new DocumentAccessDeniedError("doc-1"), 403],
  ])("maps %s to its HTTP status", async (error, status) => {
    const { controller } = setup(vi.fn().mockResolvedValue(Result.fail(error)));

    const response = await controller.put({
      params: { nanobookId: "book-a" },
      request: request("PUT", { path: "guia", password: "una-clave-segura" }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(response.status).toBe(status);
  });

  it("clears the protection", async () => {
    const { controller, clear } = setup(vi.fn(), vi.fn().mockResolvedValue(Result.ok()));

    const response = await controller.delete({
      params: { nanobookId: "book-a" },
      request: request("DELETE", { path: "guia" }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ secured: false });
    expect(clear).toHaveBeenCalledWith("book-a", "guia", "owner-1");
  });
});

describe("UnlockDocumentController", () => {
  const context = (execute: ReturnType<typeof vi.fn>, headers: Record<string, string> = {}) => ({
    controller: new UnlockDocumentController({ execute } as unknown as UnlockDocument),
    call: (body: unknown) =>
      new UnlockDocumentController({ execute } as unknown as UnlockDocument).handle({
        params: { nanobookId: "book-a" },
        request: request("POST", body, headers),
        clientAddress: "203.0.113.7",
      } as never),
  });

  it("sets an HttpOnly grant cookie on success", async () => {
    const execute = vi.fn().mockResolvedValue(Result.ok({ cookieName: "nbk-grant-abc", token: "t.s", maxAgeSeconds: 43200 }));

    const response = await context(execute).call({ path: "guia", password: "clave-correcta" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const cookie = response.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("nbk-grant-abc=t.s");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/n");
    expect(cookie).toContain("Max-Age=43200");
  });

  it("derives a hashed client key from the platform IP header", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentUnlockFailedError()));

    await context(execute, { "x-vercel-forwarded-for": "198.51.100.9" }).call({ path: "guia", password: "x" });

    const key = execute.mock.calls[0][0].clientKey as string;
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain("198.51.100.9");
  });

  it("answers 403 with a generic message for a wrong password", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentUnlockFailedError()));

    const response = await context(execute).call({ path: "guia", password: "mal" });

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("Contraseña incorrecta");
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("answers 429 with Retry-After when rate limited", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentUnlockRateLimitedError(420)));

    const response = await context(execute).call({ path: "guia", password: "x" });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("420");
  });

  it("answers a generic 404 for unknown or unprotected documents", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentNotFoundError("guia")));

    const response = await context(execute).call({ path: "guia", password: "x" });

    expect(response.status).toBe(404);
  });

  it("rejects malformed bodies without calling the use case", async () => {
    const execute = vi.fn();

    const response = await context(execute).call({ path: "guia" });

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/documents/server/infraestructure/rest/DocumentAccessControllers.test.ts`
Expected: FAIL (módulos no encontrados).

- [ ] **Step 3: Implementar los controladores**

`DocumentAccessAdminController.ts`:

```ts
import type { APIRoute } from "astro";

import type { ClearDocumentPassword } from "../../application/access/ClearDocumentPassword";
import type { DocumentAccessAdminError, SetDocumentPassword } from "../../application/access/SetDocumentPassword";
import {
  DocumentAccessDeniedError,
  DocumentNotFoundError,
  DocumentRevisionConflictError,
  InvalidDocumentPasswordError,
} from "../../domain/errors";
import { jsonResponse } from "./utils";

function toResponse(error: DocumentAccessAdminError): Response {
  if (error instanceof InvalidDocumentPasswordError) return jsonResponse({ error: error.message }, 400);
  if (error instanceof DocumentNotFoundError) return jsonResponse({ error: error.message }, 404);
  if (error instanceof DocumentAccessDeniedError) return jsonResponse({ error: error.message }, 403);
  if (error instanceof DocumentRevisionConflictError) return jsonResponse({ error: error.message }, 409);
  console.error(error);
  return jsonResponse({ error: "Error interno del servidor" }, 500);
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const payload = JSON.parse(await request.text());
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export class DocumentAccessAdminController {
  constructor(
    private readonly setPassword: SetDocumentPassword,
    private readonly clearPassword: ClearDocumentPassword,
  ) {}

  put: APIRoute = async ({ params, request, locals }) => {
    if (!locals.currentUserId) return jsonResponse({ error: "Autenticación requerida" }, 401);
    const { nanobookId } = params;
    if (!nanobookId) return jsonResponse({ error: "Falta el parámetro nanobookId" }, 400);

    const body = await readBody(request);
    if (!body || typeof body.path !== "string" || !body.path || typeof body.password !== "string") {
      return jsonResponse({ error: "path y password son obligatorios" }, 400);
    }

    const result = await this.setPassword.execute(nanobookId, body.path, body.password, locals.currentUserId);
    return result.isSuccess ? jsonResponse({ secured: true }, 200) : toResponse(result.getError());
  };

  delete: APIRoute = async ({ params, request, locals }) => {
    if (!locals.currentUserId) return jsonResponse({ error: "Autenticación requerida" }, 401);
    const { nanobookId } = params;
    if (!nanobookId) return jsonResponse({ error: "Falta el parámetro nanobookId" }, 400);

    const body = await readBody(request);
    if (!body || typeof body.path !== "string" || !body.path) {
      return jsonResponse({ error: "path es obligatorio" }, 400);
    }

    const result = await this.clearPassword.execute(nanobookId, body.path, locals.currentUserId);
    return result.isSuccess ? jsonResponse({ secured: false }, 200) : toResponse(result.getError());
  };
}
```

`UnlockDocumentController.ts`:

```ts
import { createHash } from "node:crypto";
import type { APIRoute } from "astro";

import type { UnlockDocument } from "../../application/access/UnlockDocument";
import {
  DocumentNotFoundError,
  DocumentUnlockFailedError,
  DocumentUnlockRateLimitedError,
} from "../../domain/errors";
import { jsonResponse } from "./utils";

function clientKey(request: Request, clientAddress: string | undefined): string {
  const ip = request.headers.get("x-vercel-forwarded-for") ?? clientAddress ?? "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function grantCookie(name: string, token: string, maxAgeSeconds: number): string {
  const secure = process.env.VERCEL === "1" ? "; Secure" : "";
  return `${name}=${token}; Path=/n; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

export class UnlockDocumentController {
  constructor(private readonly unlockDocument: UnlockDocument) {}

  handle: APIRoute = async ({ params, request, clientAddress }) => {
    const { nanobookId } = params;
    if (!nanobookId) return jsonResponse({ error: "Falta el parámetro nanobookId" }, 400);

    let body: { path?: unknown; password?: unknown };
    try {
      body = JSON.parse(await request.text());
    } catch {
      return jsonResponse({ error: "Solicitud inválida" }, 400);
    }
    if (typeof body?.path !== "string" || !body.path || typeof body.password !== "string" || !body.password) {
      return jsonResponse({ error: "path y password son obligatorios" }, 400);
    }

    let address: string | undefined;
    try {
      address = clientAddress;
    } catch {
      address = undefined;
    }

    const result = await this.unlockDocument.execute({
      nanobookId,
      documentPath: body.path,
      password: body.password,
      clientKey: clientKey(request, address),
    });

    if (result.isSuccess) {
      const grant = result.getValue();
      const response = jsonResponse({ ok: true }, 200);
      response.headers.set("Set-Cookie", grantCookie(grant.cookieName, grant.token, grant.maxAgeSeconds));
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const error = result.getError();
    if (error instanceof DocumentUnlockRateLimitedError) {
      const response = jsonResponse({ error: error.message }, 429);
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return response;
    }
    if (error instanceof DocumentUnlockFailedError) return jsonResponse({ error: error.message }, 403);
    if (error instanceof DocumentNotFoundError) return jsonResponse({ error: "Documento no encontrado" }, 404);
    console.error(error);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  };
}
```

- [ ] **Step 4: Ejecutar las pruebas de los controladores**

Run: `npx vitest run src/documents/server/infraestructure/rest/DocumentAccessControllers.test.ts`
Expected: PASS.

- [ ] **Step 5: Componer en `DocumentModule`**

En `src/documents/server/index.ts`:

1. Cambiar el import de entorno:
```ts
import { BETTER_AUTH_SECRET, GITHUB_TOKEN } from "astro:env/server";
```
2. Añadir imports:
```ts
import { AuthorizeDocumentAccess } from "./application/access/AuthorizeDocumentAccess";
import { ClearDocumentPassword } from "./application/access/ClearDocumentPassword";
import { SetDocumentPassword } from "./application/access/SetDocumentPassword";
import { UnlockDocument } from "./application/access/UnlockDocument";
import { DEFAULT_ACCESS_GRANT_POLICY } from "./domain/access/AccessGrantPolicy";
import { PasswordAccessPolicy } from "./domain/access/DocumentAccessPolicy";
import { DrizzleDocumentAccessRepository } from "./infraestructure/access/DrizzleDocumentAccessRepository";
import { DrizzleUnlockAttemptLimiter } from "./infraestructure/access/DrizzleUnlockAttemptLimiter";
import { HmacAccessGrantCodec } from "./infraestructure/access/HmacAccessGrantCodec";
import { ScryptPasswordHasher } from "./infraestructure/access/ScryptPasswordHasher";
import { DocumentAccessAdminController } from "./infraestructure/rest/DocumentAccessAdminController";
import { UnlockDocumentController } from "./infraestructure/rest/UnlockDocumentController";
```
3. Añadir al constructor de `DocumentModule`, tras `public readonly getDocument: GetDocument,`:
```ts
    public readonly authorizeDocumentAccess: AuthorizeDocumentAccess,
    public readonly documentAccessAdminController: DocumentAccessAdminController,
    public readonly unlockDocumentController: UnlockDocumentController,
```
4. En `static async create`, antes del `return new DocumentModule(`:
```ts
    const accessRepository = new DrizzleDocumentAccessRepository(db);
    const grantCodec = new HmacAccessGrantCodec(
      BETTER_AUTH_SECRET ?? "nanobook-development-secret",
    );
    const hasher = new ScryptPasswordHasher();
    const unlockLimiter = new DrizzleUnlockAttemptLimiter(db, DEFAULT_ACCESS_GRANT_POLICY);
    const authorizeDocumentAccess = new AuthorizeDocumentAccess(
      accessRepository,
      grantCodec,
      new PasswordAccessPolicy(),
    );
    const unlockDocument = new UnlockDocument(
      getDocument,
      accessRepository,
      hasher,
      unlockLimiter,
      grantCodec,
      DEFAULT_ACCESS_GRANT_POLICY,
    );
    const documentAccessAdminController = new DocumentAccessAdminController(
      new SetDocumentPassword(contentRepository, accessRepository, hasher, eventBus),
      new ClearDocumentPassword(contentRepository, accessRepository, eventBus),
    );
    const unlockDocumentController = new UnlockDocumentController(unlockDocument);
```
5. Pasar los tres valores al final de los argumentos de `new DocumentModule(...)`, tras `getDocument,`.

- [ ] **Step 6: Verificar que nada más construye `DocumentModule` directamente**

Run: `grep -rn "new DocumentModule" src`
Expected: solo la aparición dentro de `DocumentModule.create`. Si aparece otra (p. ej. en pruebas), pasarle `undefined as never` para los tres parámetros nuevos.

- [ ] **Step 7: Crear las rutas**

`src/pages/api/nanobooks/[nanobookId]/document-access/index.ts`:

```ts
import type { APIRoute } from "astro";
import { getApp } from "../../../../../application/server/Application";
import { protectNanobookWriteMutation } from "../../../../../nanobooks/server/infraestructure/rest/withNanobookWriteAccess";

export const prerender = false;

const app = await getApp();
const controller = app.nanobookModule.documentModule.documentAccessAdminController;

function dispatch(handler: APIRoute): APIRoute {
  return protectNanobookWriteMutation(
    app.routeProtector,
    app.nanobookModule.requireNanobookAccess,
    handler,
  );
}

export const PUT = dispatch(controller.put);
export const DELETE = dispatch(controller.delete);
```

`src/pages/api/nanobooks/[nanobookId]/document-access/unlock.ts`:

```ts
import type { APIRoute } from "astro";
import { getApp } from "../../../../../application/server/Application";

export const prerender = false;

const app = await getApp();

/**
 * Public: readers have no session. Only public nanobooks serve a challenge, so
 * a private nanobook answers 404 and cannot be probed for passwords.
 */
export const POST: APIRoute = async (context) => {
  const nanobookId = context.params.nanobookId;
  if (!nanobookId) return new Response(null, { status: 404 });

  const access = await app.nanobookModule.requireNanobookAccess.execute(undefined, nanobookId, "read");
  if (!access.isSuccess) {
    return new Response(JSON.stringify({ error: "Documento no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return app.nanobookModule.documentModule.unlockDocumentController.handle(context);
};
```

- [ ] **Step 8: Verificar compilación y pruebas**

Run: `npm run build`
Expected: build correcto.

Run: `npx vitest run src/documents`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/documents/server/infraestructure/rest/DocumentAccessAdminController.ts src/documents/server/infraestructure/rest/UnlockDocumentController.ts src/documents/server/infraestructure/rest/DocumentAccessControllers.test.ts src/documents/server/index.ts "src/pages/api/nanobooks/[nanobookId]/document-access"
git commit -m "feat(documents): rutas para administrar y resolver el desafío de contraseña"
```

---

### Task 11: Navegación depurada por espectador e icono de candado

**Files:**
- Create: `src/navigation/server/application/restrictSecuredNavigation.ts`
- Create: `src/shared/icons/lock.svg`
- Modify: `src/navigation/server/index.ts`
- Modify: `src/navigation/browser/ui/components/IndexList/DocumentIndex.astro`
- Modify: `src/navigation/browser/ui/components/SidebarNav/SidebarList.astro`
- Test: `src/navigation/server/application/restrictSecuredNavigation.test.ts`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
import { describe, expect, it } from "vitest";

import type { NavigationNode, NavigationService } from "../domain/types";
import { restrictSecuredNavigation } from "./restrictSecuredNavigation";

function node(overrides: Partial<NavigationNode> & { secured?: boolean } = {}): NavigationNode {
  const { secured, ...rest } = overrides;
  return {
    id: "doc-1",
    path: "guia",
    slug: "guia",
    title: "Guía",
    description: "Texto que revela contenido",
    isIndex: false,
    parentId: undefined,
    position: 0,
    metadata: {
      title: "Guía",
      description: "Texto que revela contenido",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      tags: ["privado"],
      cover: "https://cdn.test/portada.png",
      secured,
    },
    children: [],
    ...rest,
  };
}

function service(nodes: NavigationNode[]): NavigationService {
  return {
    getHref: (path) => `/n/libro/${path}`,
    getDocumentIdByPath: () => "doc-1",
    getBreadcrumbs: () => [],
    getSidebarEntries: () => nodes,
    getParentEntry: () => null,
    getImmediateChildren: () => nodes,
    getInvalidatedIds: () => ({ invalidatedIds: [], removedIds: [], addedIds: [] }),
  };
}

describe("restrictSecuredNavigation", () => {
  it("keeps title, path and the flag of protected nodes but hides descriptive data", () => {
    const restricted = restrictSecuredNavigation(service([node({ secured: true })]));

    const [entry] = restricted.getImmediateChildren("index");

    expect(entry.title).toBe("Guía");
    expect(entry.path).toBe("guia");
    expect(entry.metadata.secured).toBe(true);
    expect(entry.description).toBe("");
    expect(entry.metadata.description).toBe("");
    expect(entry.metadata.tags).toEqual([]);
    expect(entry.metadata.cover).toBeUndefined();
  });

  it("does not touch unprotected nodes", () => {
    const original = node();
    const restricted = restrictSecuredNavigation(service([original]));

    expect(restricted.getSidebarEntries("guia")[0]).toBe(original);
  });

  it("redacts protected descendants", () => {
    const child = node({ id: "doc-2", path: "guia/hijo", secured: true });
    const parent = node({ id: "doc-1", children: [child] });

    const [entry] = restrictSecuredNavigation(service([parent])).getImmediateChildren("index");

    expect(entry.children[0].description).toBe("");
    expect(entry.children[0].metadata.tags).toEqual([]);
  });

  it("delegates everything else to the wrapped service", () => {
    const restricted = restrictSecuredNavigation(service([]));

    expect(restricted.getHref("guia")).toBe("/n/libro/guia");
    expect(restricted.getDocumentIdByPath("guia")).toBe("doc-1");
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/navigation/server/application/restrictSecuredNavigation.test.ts`
Expected: FAIL (módulo no encontrado).

- [ ] **Step 3: Implementar**

`restrictSecuredNavigation.ts`:

```ts
import type { NavigationNode, NavigationService } from "../domain/types";

function redact(node: NavigationNode): NavigationNode {
  const children = node.children.map(redact);
  if (node.metadata.secured !== true) {
    return children.every((child, index) => child === node.children[index]) ? node : { ...node, children };
  }
  return {
    ...node,
    description: "",
    children,
    metadata: {
      ...node.metadata,
      description: "",
      tags: [],
      cover: undefined,
    },
  };
}

/**
 * Viewer-scoped view of the shared navigation graph: protected documents keep
 * their title, path and lock flag, and nothing that could describe their
 * content. The shared graph cache is never modified.
 */
export function restrictSecuredNavigation(service: NavigationService): NavigationService {
  return {
    getHref: (documentPath) => service.getHref(documentPath),
    getDocumentIdByPath: (path) => service.getDocumentIdByPath(path),
    getBreadcrumbs: (documentPath, homeTitle) => service.getBreadcrumbs(documentPath, homeTitle),
    getSidebarEntries: (documentPath) => service.getSidebarEntries(documentPath).map(redact),
    getParentEntry: (documentPath) => service.getParentEntry(documentPath),
    getImmediateChildren: (documentPath, excludePath) =>
      service.getImmediateChildren(documentPath, excludePath).map(redact),
    getInvalidatedIds: (changes) => service.getInvalidatedIds(changes),
  };
}
```

`src/navigation/server/index.ts` — añadir junto a los demás `export type`:

```ts
export { restrictSecuredNavigation } from "./application/restrictSecuredNavigation";
```

`src/shared/icons/lock.svg`:

```svg
<svg class="lock-icon h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Documento protegido" role="img">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
</svg>
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/navigation`
Expected: PASS.

- [ ] **Step 5: Mostrar el candado en el índice y en el sidebar**

`DocumentIndex.astro` — añadir el import junto a los otros iconos:

```astro
import LockSvg from "../../../../../shared/icons/lock.svg";
```

y cambiar la línea del título:

```astro
    <span class="index-card-title">{page.metadata.title}</span>
```
por:
```astro
    <span class="index-card-title">
      {page.metadata.title}
      {page.metadata.secured && <LockSvg />}
    </span>
```

`SidebarList.astro` — añadir el import junto a los otros iconos:

```astro
import LockSvg from "../../../../../shared/icons/lock.svg";
```

y dentro de `<span class="sidebar-text" slot="label" title={page.title}>`:
```astro
              {page.title}
              {page.metadata.secured && <LockSvg />}
```

(Ajustar la profundidad `../` del import a la ruta real de cada componente; ambos usan los mismos íconos de `src/shared/icons/` que ya importan.)

- [ ] **Step 6: Verificar y commit**

Run: `npm run build`
Expected: build correcto.

```bash
git add src/navigation src/shared/icons/lock.svg
git commit -m "feat(navigation): depura documentos protegidos por espectador y muestra candado"
```

---

### Task 12: Guard en `DocumentPage` y formulario de desbloqueo

**Files:**
- Create: `src/documents/browser/ui/components/DocumentUnlockForm.astro`
- Modify: `src/documents/browser/ui/pages/DocumentPage.astro`

- [ ] **Step 1: Crear el formulario de desbloqueo**

`DocumentUnlockForm.astro`:

```astro
---
interface Props {
  nanobookId: string;
  documentPath: string;
  title: string;
  indexHref: string;
}

const { nanobookId, documentPath, title, indexHref } = Astro.props;
---

<section
  class="document-unlock mx-auto max-w-md border border-[var(--theme-border)] p-8"
  data-nanobook-id={nanobookId}
  data-document-path={documentPath}
>
  <span class="tech-label mb-3 block">Documento protegido</span>
  <h1 class="mb-4 text-3xl font-semibold tracking-tight">{title}</h1>
  <p class="mb-6 text-[var(--theme-text-muted)]">
    Escribe la contraseña para ver este documento.
  </p>

  <form data-unlock-form novalidate>
    <label for="unlock-password" class="mb-2 block text-sm font-medium">Contraseña</label>
    <input
      id="unlock-password"
      name="password"
      type="password"
      required
      autocomplete="off"
      class="mb-4 w-full border border-[var(--theme-border)] bg-transparent px-3 py-2"
    />
    <p data-unlock-error role="alert" aria-live="polite" hidden class="mb-4 text-sm text-[var(--theme-error, #b3261e)]"></p>
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        class="inline-flex min-h-10 items-center border border-[var(--theme-accent)] bg-[var(--theme-accent)] px-4 py-2 text-sm font-medium text-[var(--theme-accent-text)]"
      >
        Desbloquear
      </button>
      <a href={indexHref} class="text-sm underline">Volver al índice</a>
    </div>
  </form>
</section>

<script>
  function setup() {
    const root = document.querySelector<HTMLElement>(".document-unlock");
    if (!root || root.dataset.ready === "true") return;
    root.dataset.ready = "true";

    const form = root.querySelector<HTMLFormElement>("[data-unlock-form]");
    const error = root.querySelector<HTMLElement>("[data-unlock-error]");
    const input = root.querySelector<HTMLInputElement>("#unlock-password");
    const submit = root.querySelector<HTMLButtonElement>("button[type=submit]");
    if (!form || !error || !input || !submit) return;

    const show = (message: string) => {
      error.textContent = message;
      error.hidden = false;
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;
      if (!input.value) {
        show("Escribe la contraseña.");
        input.focus();
        return;
      }

      submit.disabled = true;
      try {
        const response = await fetch(
          `/api/nanobooks/${encodeURIComponent(root.dataset.nanobookId ?? "")}/document-access/unlock`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ path: root.dataset.documentPath, password: input.value }),
          },
        );
        if (response.ok) {
          window.location.reload();
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (response.status === 429) {
          const wait = Number(response.headers.get("Retry-After") ?? 0);
          show(wait > 0 ? `Demasiados intentos. Prueba de nuevo en ${Math.ceil(wait / 60)} min.` : "Demasiados intentos.");
        } else {
          show(payload.error ?? "No fue posible desbloquear el documento.");
        }
        input.select();
      } catch {
        show("No fue posible conectar. Revisa tu conexión y que las cookies estén habilitadas.");
      } finally {
        submit.disabled = false;
      }
    });
  }

  document.addEventListener("astro:page-load", setup);
</script>
```

- [ ] **Step 2: Modificar `DocumentPage.astro` — imports**

Añadir tras `import DocumentPageController from "../DocumentPageController.astro";`:

```astro
import DocumentUnlockForm from "../components/DocumentUnlockForm.astro";
import { restrictSecuredNavigation } from "../../../../navigation/server";
```

- [ ] **Step 3: Modificar `DocumentPage.astro` — navegación por espectador**

Sustituir:

```astro
const navigationService = await measure("navigation", () =>
  navigationModule.getNavigation(nanobookId, {
    rootPath: "index",
    basePath: `/n/${nanobook.getSlug()}`,
  })
);
```
por:
```astro
const sharedNavigation = await measure("navigation", () =>
  navigationModule.getNavigation(nanobookId, {
    rootPath: "index",
    basePath: `/n/${nanobook.getSlug()}`,
  })
);
// Writers see the whole book; everyone else sees protected documents redacted.
const navigationService = canEdit ? sharedNavigation : restrictSecuredNavigation(sharedNavigation);
```

- [ ] **Step 4: Modificar `DocumentPage.astro` — guard antes de publicar**

Sustituir el bloque:

```astro
if (!document) throw new Error("Document not found");
const renderedPage = await measure("publish", () =>
  publishingModule.pagePublisher.publish(document)
);
if (!renderedPage) throw new Error("Page not found");
const { rendered, headings } = renderedPage;
const { entry, renderedBody } = rendered;
```
por:
```astro
if (!document) throw new Error("Document not found");

// A proxy takes its target's identity, so protection is checked on the whole
// chain: the stored document and the resolved one.
const rawDocument = await measure("document-raw", () =>
  documentModule.getDocument.executeRaw(nanobookId, slug)
);
const hasSecuredLink = [rawDocument, document].some((item) => item?.getMetadata().secured === true);
// Public nanobooks skip the session read; resolve it only when a link is protected.
const accessViewer =
  hasSecuredLink && !user
    ? await measure("access-session", () =>
        app.authServerModule.getSession(Astro.request, Astro.response.headers)
      )
    : user;
const accessDecision = await measure("access", () =>
  documentModule.authorizeDocumentAccess.execute({
    documents: [rawDocument, document],
    canWrite: new AuthorizeNanobook().canWrite(nanobook, accessViewer?.id),
    cookieHeader: Astro.request.headers.get("cookie"),
  })
);
const challenged = accessDecision.kind === "challenge";

const renderedPage = challenged
  ? null
  : await measure("publish", () => publishingModule.pagePublisher.publish(document));
if (!challenged && !renderedPage) throw new Error("Page not found");
const headings = renderedPage?.headings ?? [];
// When challenged, only the title is used; no content reaches the response.
const entry = renderedPage?.rendered.entry ?? document.parse();
const renderedBody = renderedPage?.rendered.renderedBody ?? "";

if (challenged) {
  Astro.response.status = 401;
  Astro.response.headers.set("X-Robots-Tag", "noindex, nofollow");
}
```

- [ ] **Step 6 (nota de orden): ajustar `canonicalHref`**

Sustituir:
```astro
const canonicalHref = entry.ref
```
por:
```astro
const canonicalHref = !challenged && entry.ref
```

- [ ] **Step 7: Modificar el `<Layout>` y el cuerpo**

En las props de `<Layout ...>` cambiar:

```astro
  description={entry.description}
  headings={headings}
```
por:
```astro
  description={challenged ? undefined : entry.description}
  headings={challenged ? [] : headings}
  hideToc={challenged}
```

y sustituir la apertura del cuerpo:

```astro
  {
    entry.isIndex ? (
      <IndexList
```
por:
```astro
  {
    challenged ? (
      <DocumentUnlockForm
        nanobookId={nanobookId}
        documentPath={slug}
        title={document.getTitle()}
        indexHref={baseHref}
      />
    ) : entry.isIndex ? (
      <IndexList
```

- [ ] **Step 8: Compilar**

Run: `npm run build`
Expected: build correcto, sin errores de tipos en `DocumentPage.astro`.

- [ ] **Step 9: Verificación manual del flujo (obligatoria)**

Run: `npm run dev` y, en el navegador, con un nanobook **público** y un documento de prueba:

1. Con `curl`/DevTools comprobar que `GET /n/<slug>/<doc>` de un documento **no protegido** sigue respondiendo 200.
2. Marcar el documento como protegido usando el panel de la Tarea 13 (o, mientras tanto, `PUT /api/nanobooks/<id>/document-access` con la sesión del propietario).
3. Como visitante anónimo: la URL responde **401**, muestra el formulario y el HTML **no contiene** el cuerpo ni la descripción (`curl -s <url> | grep -c "texto del cuerpo"` → `0`).
4. Contraseña incorrecta → mensaje de error; 5 fallos → mensaje de espera y `429`.
5. Contraseña correcta → la página recarga y muestra el documento (200); cambiar la contraseña desde el panel y recargar → vuelve el desafío.
6. Como propietario con sesión: el documento se abre sin desafío, también en un nanobook público.

Si el paso 3 no devuelve **401** (Astro no aplica `Astro.response.status` desde un componente), mover el guard a `src/pages/n/[nanobookSlug]/[...slug]/index.astro`: resolver allí `rawDocument`, `document` y `challenged`, fijar `Astro.response.status = 401` en la página y pasar `challenged` como prop a `DocumentPage`. El resto del diseño no cambia.

- [ ] **Step 10: Commit**

```bash
git add src/documents/browser/ui/components/DocumentUnlockForm.astro src/documents/browser/ui/pages/DocumentPage.astro
git commit -m "feat(documents): desafío de contraseña en la página del documento"
```

---

### Task 13: Panel «Protección» en el editor

**Files:**
- Create: `src/documents/browser/ui/components/DocumentProtectionPanel.astro`
- Modify: `src/documents/browser/ui/pages/EditPage.astro`

- [ ] **Step 1: Crear el panel**

`DocumentProtectionPanel.astro`:

```astro
---
interface Props {
  nanobookId: string;
  documentPath: string;
  secured: boolean;
}

const { nanobookId, documentPath, secured } = Astro.props;
---

<section
  class="protection-panel mb-8 border border-[var(--theme-border)] p-6"
  data-protection-panel
  data-nanobook-id={nanobookId}
  data-document-path={documentPath}
  data-secured={secured ? "true" : "false"}
>
  <h2 class="mb-2 text-lg font-semibold">Protección</h2>
  <p class="mb-4 text-sm text-[var(--theme-text-muted)]" data-protection-status>
    {secured ? "Este documento está protegido con contraseña." : "Este documento es visible para quien pueda leer el nanobook."}
  </p>
  <p class="mb-4 text-sm text-[var(--theme-text-muted)]">
    Guarda tus cambios antes: al aplicar la protección la página se recarga.
  </p>

  <form data-protection-form novalidate>
    <label for="protection-password" class="mb-2 block text-sm font-medium">
      {secured ? "Nueva contraseña" : "Contraseña"} (8 a 128 caracteres)
    </label>
    <input
      id="protection-password"
      type="password"
      autocomplete="new-password"
      minlength="8"
      maxlength="128"
      class="mb-3 w-full max-w-sm border border-[var(--theme-border)] bg-transparent px-3 py-2"
    />
    <p data-protection-message role="status" aria-live="polite" hidden class="mb-3 text-sm"></p>
    <div class="flex flex-wrap gap-3">
      <button type="submit" class="inline-flex min-h-10 items-center border border-[var(--theme-accent)] px-4 py-2 text-sm font-medium">
        {secured ? "Cambiar contraseña" : "Proteger"}
      </button>
      {secured && (
        <button type="button" data-protection-clear class="inline-flex min-h-10 items-center border border-[var(--theme-border)] px-4 py-2 text-sm font-medium">
          Quitar protección
        </button>
      )}
    </div>
  </form>
</section>

<script>
  function setup() {
    const panel = document.querySelector<HTMLElement>("[data-protection-panel]");
    if (!panel || panel.dataset.ready === "true") return;
    panel.dataset.ready = "true";

    const form = panel.querySelector<HTMLFormElement>("[data-protection-form]");
    const input = panel.querySelector<HTMLInputElement>("#protection-password");
    const message = panel.querySelector<HTMLElement>("[data-protection-message]");
    const clear = panel.querySelector<HTMLButtonElement>("[data-protection-clear]");
    if (!form || !input || !message) return;

    const endpoint = `/api/nanobooks/${encodeURIComponent(panel.dataset.nanobookId ?? "")}/document-access`;
    const path = panel.dataset.documentPath;
    const say = (text: string) => {
      message.textContent = text;
      message.hidden = false;
    };

    async function send(method: "PUT" | "DELETE", body: Record<string, string>) {
      const response = await fetch(endpoint, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        window.location.reload();
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      say(payload.error ?? "No fue posible actualizar la protección.");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      message.hidden = true;
      if (input.value.length < 8 || input.value.length > 128) {
        say("La contraseña debe tener entre 8 y 128 caracteres.");
        input.focus();
        return;
      }
      await send("PUT", { path: path ?? "", password: input.value });
    });

    clear?.addEventListener("click", async () => {
      if (!window.confirm("¿Quitar la protección? Cualquiera con acceso al nanobook podrá leer el documento.")) return;
      message.hidden = true;
      await send("DELETE", { path: path ?? "" });
    });
  }

  document.addEventListener("astro:page-load", setup);
</script>
```

- [ ] **Step 2: Insertarlo en `EditPage.astro`**

Añadir el import junto a `DocumentActionLink`:

```astro
import DocumentProtectionPanel from "../components/DocumentProtectionPanel.astro";
```

y, justo después del `<div class="mb-10 border-b ...">…</div>` de la cabecera «Editando documento» y antes del bloque `entry.ref && (`, insertar:

```astro
  <DocumentProtectionPanel
    nanobookId={nanobookId}
    documentPath={editableEntry.slug}
    secured={editableEntry.metadata.secured === true}
  />
```

- [ ] **Step 3: Compilar**

Run: `npm run build`
Expected: build correcto.

- [ ] **Step 4: Verificación manual**

Con `npm run dev`, como propietario: abrir `/n/<slug>/<doc>/edit`, proteger con una contraseña de 8+ caracteres (la página recarga y el panel indica «protegido»); intentar con 7 caracteres (mensaje de validación); cambiar la contraseña; quitar la protección (confirmación) y comprobar que el documento vuelve a ser público. Guardar el documento desde el editor **después** de proteger y comprobar que `secured` se conserva (el panel sigue mostrando «protegido»).

- [ ] **Step 5: Commit**

```bash
git add src/documents/browser/ui/components/DocumentProtectionPanel.astro src/documents/browser/ui/pages/EditPage.astro
git commit -m "feat(documents): panel para proteger documentos desde el editor"
```

---

### Task 14: Documentación, changelog y verificación final

**Files:**
- Modify: `CHANGELOG.md`
- Create: `src/content/nanobook-project/arquitectura/documentos-protegidos.md`

- [ ] **Step 1: Registrar en el changelog**

Bajo `## [Unreleased]`, al inicio, añadir:

```markdown
- Añadidos documentos protegidos con contraseña: el propietario marca un documento desde el editor y los demás lectores deben resolver un desafío en la misma URL antes de que se renderice. La contraseña se guarda como hash scrypt en `document_access` (migración `0016`), el desbloqueo emite una cookie HMAC por documento de 12 h ligada a la versión de la contraseña, los fallos se limitan a 5 por documento e IP cada 15 minutos, y el índice y el sidebar muestran solo título y candado.
```

- [ ] **Step 2: Documentar la decisión**

Crear `src/content/nanobook-project/arquitectura/documentos-protegidos.md` con el frontmatter habitual de los documentos de esa carpeta (`title: "Documentos protegidos con contraseña"`, `description`, `date: 2026-11-04`, `author: "Nanobook"`, `tags: ["seguridad", "documentos", "acceso"]`, `draft: false`) y este cuerpo: contexto, decisión (guard por ruta, cookie firmada, hash scrypt en tabla aparte, `secured` gestionado por el servidor), reglas de acceso (el escritor entra directo; la cadena de proxies exige una concesión por eslabón protegido), superficies depuradas (índice, sidebar, TOC), límites (5 intentos / 15 min), lo que queda fuera (herencia, perfiles, renovación deslizante, MCP) y referencia a la spec y al plan en `docs/superpowers/`.

> Los documentos de `src/content` son ahora una fuente histórica (el contenido vive en SQL): este archivo documenta la decisión para quien lea el repositorio; no debe describirse como contenido publicado.

- [ ] **Step 3: Ejecutar toda la suite y el build**

Run: `npm test`
Expected: toda la suite en verde, incluidas las pruebas nuevas.

Run: `npm run build`
Expected: build correcto.

- [ ] **Step 4: Aplicar la migración en el entorno de desarrollo**

Run: `npm run database:migrate`
Expected: `Database migrations applied.`

Verificar que la migración `0016` se aplicó antes de desplegar; en producción debe ejecutarse contra la **misma** base que usa el despliegue (un fallo previo se debió a migrar una base distinta).

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md src/content/nanobook-project/arquitectura/documentos-protegidos.md
git commit -m "docs(documents): documenta los documentos protegidos y el changelog"
```

---

## Verificación de la spec

| Requisito de la spec | Tarea |
|---|---|
| Atributo `secured` gestionado por el servidor y conservado al editar | 1 |
| Política de acceso y puertos; falla cerrado | 2, 8 |
| Hash scrypt, nunca en frontmatter | 3, 5, 6, 7 |
| Cookie firmada por documento, 12 h, ligada a `password_version` | 4, 8, 10 |
| Revocación al cambiar o quitar la contraseña | 6, 7, 8 |
| Límite de intentos (5 / 15 min) con `429` | 6, 8, 10 |
| Propietario entra sin desafío (incluida sesión diferida en nanobooks públicos) | 12 |
| Desafío en la misma URL con `401`, `no-store`, `noindex`, sin contenido | 12 |
| Guard antes de `pagePublisher.publish` | 12 |
| Índice y sidebar: título y candado; TOC no generado | 11, 12 |
| Proxy: protección de la cadena | 8, 9, 12 |
| Endpoint de desbloqueo solo en nanobooks públicos, respuestas genéricas | 10 |
| Panel de administración y rutas protegidas por las barreras de escritura | 10, 13 |
| MCP no lee ni cambia la contraseña | por construcción: ninguna herramienta MCP se modifica |

## Riesgos conocidos

- **`Astro.response.status` desde un componente:** se verifica en la Tarea 12 (paso 9) con un plan B definido.
- **Rutas de importación de los iconos:** la profundidad de `../` en la Tarea 11 debe copiarse de los imports de iconos que ya existen en cada componente.
- **Migración en producción:** aplicar `0016` a la base correcta antes de desplegar; sin ella, los documentos protegidos fallarían cerrados (nadie, salvo el propietario, podría abrirlos).
- **Cambio de revisión al proteger:** `SetDocumentPassword`/`ClearDocumentPassword` suben la revisión del documento; el panel recarga la página para que el editor use la revisión nueva.
