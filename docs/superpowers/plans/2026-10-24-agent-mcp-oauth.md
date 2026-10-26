# Agent MCP OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a protected MCP endpoint through which an authorized user-delegated agent can read, create, and update that user's nanobooks and documents.

**Architecture:** Add `agents/server` as an MCP adapter over the existing application capabilities. Better Auth becomes the OAuth 2.1 authorization server and MCP protected resource; the MCP HTTP route receives bearer tokens, derives the actor from verified claims, and delegates authorization to `nanobooks` before it reads or mutates content.

**Tech Stack:** Astro 7 SSR, TypeScript, Better Auth MCP/CIMD/JWT plugins, MCP TypeScript SDK v2, Drizzle/libSQL, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-agent-mcp-oauth-design.md`

## Global Constraints

- Use MCP `2026-07-28` Streamable HTTP and reject legacy session-oriented MCP requests.
- Use Better Auth `mcp()`, `jwt()` and `cimd()`; never register a second OAuth provider.
- The MCP endpoint is `POST /mcp`; all requests use HTTPS outside loopback development.
- Keep the model away from cookies, passwords, database credentials, access tokens and refresh tokens.
- The first client is Codex. Accept only its `chatgpt.com/oauth/codex/.../client.json`
  CIMD documents and PKCE; do not enable Dynamic Client Registration.
- Use `nanobooks:read` and `nanobooks:write` OAuth scopes; omit all destructive tools.
- Agent writes must retain nanobook authorization, document ownership rules and optimistic revision behavior.
- Apply generated Drizzle migrations explicitly with `npm run database:migrate` in local and production environments.

## Review Focus

- A bearer token for another resource, issuer, or expired grant must be rejected before JSON-RPC reaches a tool.
- A valid `nanobooks:read` token must not reach any write tool, including through malformed or aliased tool names.
- An actor who knows another owner's `nanobookId` must receive `403` before reading private content or mutating it.
- An expired, revoked, or rotated refresh token must not silently regain access.
- A `409` document revision conflict must preserve the persisted document and return structured tool error data rather than terminate the MCP session.

---

## Proposed file structure

```text
src/
  agents/server/
    application/
      AgentToolService.ts
      dto.ts
      errors.ts
      ports/AgentAuditWriter.ts
    infrastructure/
      audit/DrizzleAgentAuditWriter.ts
      database/DrizzleAgentAuditSchema.ts
      mcp/createMcpHandler.ts
      mcp/toMcpToolResult.ts
      oauth/McpActorReader.ts
    index.ts
  pages/mcp.ts
  auth/server/infrastructure/better-auth/
    BetterAuth.ts
    DrizzleAuthSchema.ts
  nanobooks/server/application/
    RequireNanobookAccess.ts
```

The exact Better Auth generated schema additions belong in its existing schema
file and are materialized by a new Drizzle migration; do not hand-write a
separate OAuth schema with overlapping tables.

### Task 1: Upgrade and compose the MCP OAuth provider

**Files:**
- Modify: `package.json`
- Modify: `src/auth/server/infrastructure/better-auth/BetterAuth.ts`
- Modify: `src/auth/server/infrastructure/better-auth/DrizzleAuthSchema.ts`
- Modify: `astro.config.mjs`
- Create: `src/auth/server/infrastructure/better-auth/McpOAuthConfig.ts`
- Create: `src/auth/server/infrastructure/better-auth/McpOAuthConfig.test.ts`
- Create: `drizzle/0011_*.sql` and matching `drizzle/meta/*` files

**Interfaces:**
- Produces `getMcpOAuthConfig(environment): { resource: string; loginPage: string; consentPage: string }`.
- Produces `isCodexClientMetadataUrlAllowed(clientId: string): boolean` for the
  HTTPS `chatgpt.com/oauth/codex/<callback_id>/client.json` pattern.
- Produces a Better Auth instance composed with `jwt()`, `mcp()` and `cimd()`.
- Consumes the public HTTPS origin in production and loopback origin in local development.

- [ ] **Step 1: Write failing configuration tests**

Test that production rejects a non-HTTPS MCP resource, accepts an explicit
`https://<origin>/mcp` resource, accepts only Codex's HTTPS CIMD URL pattern,
and rejects all other origins, paths, credentials and query strings.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/auth/server/infrastructure/better-auth/McpOAuthConfig.test.ts`

Expected: FAIL because the MCP OAuth configuration does not exist.

- [ ] **Step 3: Install compatible Better Auth MCP dependencies and implement the configuration**

Update Better Auth to a version that supports `@better-auth/mcp` and
`@better-auth/cimd`; add the official MCP server SDK v2. Configure `jwt()`,
`mcp({ resource, loginPage, consentPage, scopes })` and `cimd()` in
`createBetterAuth()`, with the Node secure metadata fetcher, MCP 2026-07-28
metadata profile and the Codex-only CIMD allow predicate. Do not add
`oauthProvider()` separately. Generate the provider schema and Drizzle
migration through the supported Better Auth/Drizzle workflow.

- [ ] **Step 4: Add schema migration characterization coverage**

Verify a disposable libSQL database receives the OAuth client, access-token,
refresh-token and consent tables once, and a second migration run is
idempotent.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/auth/server/infrastructure/better-auth/McpOAuthConfig.test.ts src/shared/infrastructure/database`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/auth/server drizzle astro.config.mjs
git commit -m "feat(auth): add MCP OAuth provider"
```

### Task 2: Make nanobook access reusable by HTTP and MCP adapters

**Files:**
- Create: `src/nanobooks/server/application/RequireNanobookAccess.ts`
- Create: `src/nanobooks/server/application/RequireNanobookAccess.test.ts`
- Modify: `src/nanobooks/server/infraestructure/rest/withNanobookWriteAccess.ts`
- Modify: `src/nanobooks/server/index.ts`

**Interfaces:**
- Produces `RequireNanobookAccess.execute(actorId: string, nanobookId: string, permission: NanobookPermission): Promise<Result<Error, Nanobook>>`.
- Consumes `NanobookRepository` and `AuthorizeNanobook`.
- HTTP and agent adapters use the same operation before document access.

- [ ] **Step 1: Write failing access tests**

Cover owner write access, public read access, private read denial, missing
nanobook, and a non-owner write denial using real `Nanobook` entities.

- [ ] **Step 2: Run the access tests to verify they fail**

Run: `npm test -- src/nanobooks/server/application/RequireNanobookAccess.test.ts`

Expected: FAIL because the application capability does not exist.

- [ ] **Step 3: Implement `RequireNanobookAccess` and recompose HTTP authorization**

Implement the exact interface above. Replace the route decorator's direct
repository read with this capability; retain its HTTP status mapping.

- [ ] **Step 4: Run access and route authorization tests**

Run: `npm test -- src/nanobooks/server/application/RequireNanobookAccess.test.ts src/nanobooks/server/infraestructure/rest/withNanobookWriteAccess.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nanobooks/server
git commit -m "refactor(nanobooks): share access authorization"
```

### Task 3: Define agent application tools and audited writes

**Files:**
- Create: `src/agents/server/application/AgentToolService.ts`
- Create: `src/agents/server/application/dto.ts`
- Create: `src/agents/server/application/errors.ts`
- Create: `src/agents/server/application/AgentToolService.test.ts`
- Create: `src/agents/server/application/ports/AgentAuditWriter.ts`
- Create: `src/agents/server/infrastructure/database/DrizzleAgentAuditSchema.ts`
- Create: `src/agents/server/infrastructure/audit/DrizzleAgentAuditWriter.ts`
- Create: `src/agents/server/infrastructure/audit/DrizzleAgentAuditWriter.test.ts`
- Create: `drizzle/0012_*.sql` and matching `drizzle/meta/*` files

**Interfaces:**
- Produces `AgentToolService` methods: `listNanobooks`, `getNanobook`,
  `createNanobook`, `updateNanobook`, `listDocuments`, `getDocument`,
  `createDocument`, and `updateDocument`.
- Every method accepts `{ actorId, oauthClientId, scopes }` and a typed input.
- Write methods append an audit record only after a successful mutation.

- [ ] **Step 1: Write failing service tests for scope and ownership**

Test: read scope lists only the actor's books; a known public book can be
read but not enumerated; write scope plus ownership is required for both
document creation and update; a stale `expectedRevision` yields a structured
conflict error; successful writes request one audit record without Markdown
content.

- [ ] **Step 2: Run the service test to verify it fails**

Run: `npm test -- src/agents/server/application/AgentToolService.test.ts`

Expected: FAIL because the agent module does not exist.

- [ ] **Step 3: Implement typed DTOs, service orchestration and audit port**

Use the existing nanobook/document cases rather than repositories. Add the
read capabilities absent from the current HTTP surface by exposing application
queries through `DocumentModule`; do not make the agent module query Drizzle.
Translate successful creates/updates to existing serialized document DTOs.

- [ ] **Step 4: Implement the audit schema and writer**

Persist only `id`, actor, OAuth client, tool name, nanobook id, optional
document id, occurrence time and request id. Add the generated migration and
prove it persists no content or tokens.

- [ ] **Step 5: Run service and repository tests**

Run: `npm test -- src/agents/server/application/AgentToolService.test.ts src/agents/server/infrastructure/audit/DrizzleAgentAuditWriter.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/agents src/documents/server drizzle
git commit -m "feat(agents): add authorized nanobook tools"
```

### Task 4: Implement MCP transport and bearer actor mapping

**Files:**
- Create: `src/agents/server/infrastructure/oauth/McpActorReader.ts`
- Create: `src/agents/server/infrastructure/oauth/McpActorReader.test.ts`
- Create: `src/agents/server/infrastructure/mcp/createMcpHandler.ts`
- Create: `src/agents/server/infrastructure/mcp/createMcpHandler.test.ts`
- Create: `src/agents/server/infrastructure/mcp/toMcpToolResult.ts`
- Create: `src/agents/server/index.ts`
- Create: `src/pages/mcp.ts`
- Modify: `src/application/server/Application.ts`

**Interfaces:**
- `McpActorReader` converts verified MCP claims to `{ actorId: string; oauthClientId: string; scopes: readonly string[] }`.
- `createMcpHandler(service: AgentToolService): (request: Request) => Promise<Response>` registers the eight tools from the spec.
- The route uses Better Auth `requireMcpAuth` with resource `https://<origin>/mcp` and rejects MCP legacy transport.

- [ ] **Step 1: Write failing MCP handler tests**

Use the MCP SDK test client or raw JSON-RPC requests to assert that
`tools/list` advertises exactly the eight non-destructive tools; missing bearer
credentials produce a `401` challenge; write scope is required for write
tools; a domain conflict comes back as an MCP tool error retaining code `409`.

- [ ] **Step 2: Run the transport test to verify it fails**

Run: `npm test -- src/agents/server/infrastructure/mcp/createMcpHandler.test.ts src/agents/server/infrastructure/oauth/McpActorReader.test.ts`

Expected: FAIL because no MCP handler or route exists.

- [ ] **Step 3: Implement stateless MCP request handling**

Create one SDK `McpServer` per request, register the tool schemas with Zod and
map each invocation to `AgentToolService`. Use Better Auth's protected request
handler to validate bearer claims before the MCP handler. Ensure `POST /mcp`
is the only exposed method.

- [ ] **Step 4: Compose `AgentModule` in `Application`**

Inject only the documented application capabilities and the audit writer. Do
not expose Drizzle repositories or the Better Auth instance outside their
module boundaries.

- [ ] **Step 5: Run focused integration tests**

Run: `npm test -- src/agents/server/infrastructure/mcp src/application/server/Application.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/agents src/pages/mcp.ts src/application/server/Application.ts
git commit -m "feat(agents): expose protected MCP endpoint"
```

### Task 5: Add browser consent and operational documentation

**Files:**
- Create: `src/pages/consent.astro`
- Create: `src/pages/consent.test.ts`
- Modify: `src/pages/api/auth/[...all].ts`
- Modify: `README.md`
- Modify: `docs/operations/content-sql-deployment.md`
- Modify: `src/content/nanobook-project/arquitectura/index.md`
- Create: `src/content/nanobook-project/arquitectura/mcp-agentes-oauth.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- The consent page receives the Better Auth OAuth request context and displays
  the client identity plus `nanobooks:read` and `nanobooks:write` grants.
- Operations documentation specifies migration, MCP resource URL, client
  metadata configuration, revocation, and local/production smoke tests.

- [ ] **Step 1: Write failing consent page tests**

Test a valid pending OAuth grant renders the client name and both scopes; an
unknown or expired request never renders a consent form.

- [ ] **Step 2: Run the consent test to verify it fails**

Run: `npm test -- src/pages/consent.test.ts`

Expected: FAIL because the consent page does not exist.

- [ ] **Step 3: Implement consent UI and route wiring**

Use Better Auth's provider APIs rather than parsing OAuth parameters in the
page. Keep the browser cookie limited to this interaction; never render
issued tokens.

- [ ] **Step 4: Document connection and revocation**

Include exact `npm run database:migrate` ordering, required public URLs,
how a user reconnects after revocation, and a manual end-to-end check using
the single declared MCP client.

- [ ] **Step 5: Run full verification**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages README.md docs src/content CHANGELOG.md
git commit -m "docs(agents): document MCP OAuth connection"
```

## Self-review

- OAuth provider, bearer protection, tool transport, authorization, audit,
  consent, operations and tests each map to Tasks 1–5.
- The scope/ownership, public-read, token/audience, revocation and conflict
  failure modes from Review Focus are each covered in Tasks 1, 3 and 4.
- Every exposed write path flows through `RequireNanobookAccess`, then the
  existing document/nanobook application behavior; no task adds direct SQL
  access from MCP.
- Destructive actions, selected-book grants, DCR and non-content tools remain
  explicitly excluded.
