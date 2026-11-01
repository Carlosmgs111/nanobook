# MCP Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nanobook's OAuth-protected MCP integration safe to expose from the production HTTPS origin, with a narrow protocol boundary, least-privilege grants, durable security state, and operational evidence.

**Architecture:** Keep `agents` as the MCP adapter and keep authorization in `nanobooks`; do not create a second permission model. Move OAuth token handling behind a dedicated HTTP boundary so Astro's global origin protection can be enabled again, while `/mcp` continues to verify bearer tokens and delegates only verified claims to `AgentToolService`.

**Tech Stack:** Astro 7 SSR/Vercel, TypeScript, Better Auth 1.7, `@better-auth/mcp`, `@better-auth/cimd`, MCP TypeScript SDK v2, Drizzle/libSQL, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-agent-mcp-oauth-design.md`; production constraints in `src/content/nanobook-project/production-readiness.md`.

## Global Constraints

- Do not expose browser session cookies, passwords, database credentials, access tokens, refresh tokens, or Markdown bodies in MCP responses, logs, or audit records.
- Keep `POST /mcp` as the canonical protected resource; use HTTPS outside loopback.
- Keep `mcp()`, `jwt()`, and `cimd()` as the sole OAuth-provider composition; do not enable Dynamic Client Registration.
- Accept only HTTPS Codex CIMD metadata documents permitted by `isCodexClientMetadataUrlAllowed`.
- Enforce `nanobooks:read` for reads and `nanobooks:write` for mutations, then enforce per-nanobook domain access.
- Do not add destructive MCP tools in this hardening release.
- Preserve 401 for absent/invalid bearer credentials, 403 for scope or domain denials, 404 for absent resources, and 409 for revision conflicts.
- Before any commit or tag, run `npm run build`; update `CHANGELOG.md` under `[Unreleased]`.
- Preserve and review the current uncommitted edits before starting. In particular, do not ship the diagnostic `console.log({ actor })` currently present in `AgentToolService`.

## Review Focus

- A form-encoded OAuth token exchange must reach only the dedicated OAuth boundary; every other unsafe Astro request must retain origin validation.
- A token with a wrong issuer, audience, expired signature, or missing `nanobooks:write` must be rejected before tool dispatch.
- A public-read token must never escalate to document/nanobook mutation, even with an owned-looking identifier.
- A client-metadata URL with a lookalike host, port, query, userinfo, or non-Codex path must be rejected.
- A timeout or retry of a write must not cause an unobservable duplicate mutation; the client must have an audit correlation id and an explicit recovery procedure.

---

## Proposed file structure

```text
src/
  auth/server/
    application/OAuthTokenBoundary.ts
    infrastructure/http/OAuthTokenController.ts
    infrastructure/better-auth/BetterAuth.ts
    infrastructure/better-auth/McpOAuthConfig.ts
  agents/server/
    application/AgentToolService.ts
    infrastructure/mcp/createNanobookMcpServer.ts
    infrastructure/oauth/McpActorReader.ts
  pages/
    mcp.ts
    api/auth/[...all].ts
    api/oauth/token.ts
  shared/infrastructure/observability/
    AgentSecurityEventWriter.ts
docs/
  operations/mcp-production-runbook.md
```

The exact implementation of the isolated token boundary must be selected before Task 2: it must run outside Astro's global origin guard and expose *only* the OAuth token exchange. It must not become a general auth proxy. Its deployment origin, issuer, JWKS URL and `MCP_RESOURCE_URL` are explicit environment values; `BETTER_AUTH_URL` remains the authorization-server origin.

### Task 1: Establish the production security baseline and remove unsafe diagnostics

**Files:**
- Modify: `src/agents/server/application/AgentToolService.ts`
- Create: `src/agents/server/application/AgentToolService.test.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces no new public API.
- Preserves `AgentToolService.listNanobooks(actor: AgentActor)` without emitting the actor or scopes to standard output.

- [ ] **Step 1: Write a failing logging characterization test**

Mock `console.log`, call `listNanobooks` with an actor containing a realistic user id and scopes, and assert that no log call is made while the repository result is returned.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/agents/server/application/AgentToolService.test.ts`

Expected: FAIL because `listNanobooks` writes the actor to `console.log`.

- [ ] **Step 3: Remove only the actor diagnostic and preserve the current service behavior**

Delete `console.log({ actor })`; do not change the scope or ownership semantics in this task. Resolve the existing formatting-only edits separately from this security change.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/agents/server/application/AgentToolService.test.ts`

Expected: PASS.

- [ ] **Step 5: Record the hardening change**

Add an `[Unreleased]` security entry stating that MCP actor information is no longer emitted to process logs.

- [ ] **Step 6: Commit**

```bash
git add src/agents/server/application/AgentToolService.ts src/agents/server/application/AgentToolService.test.ts CHANGELOG.md
git commit -m "fix(agents): stop logging MCP actors"
```

### Task 2: Isolate the OAuth token exchange and restore Astro origin checks

**Files:**
- Modify: `astro.config.mjs`
- Modify: `src/auth/server/infrastructure/better-auth/BetterAuth.ts`
- Modify: `src/auth/server/infrastructure/better-auth/McpOAuthConfig.ts`
- Create: `src/auth/server/application/OAuthTokenBoundary.ts`
- Create: `src/auth/server/infrastructure/http/OAuthTokenController.ts`
- Create: `src/pages/api/oauth/token.ts`
- Create: `src/auth/server/infrastructure/http/OAuthTokenController.test.ts`
- Modify: `src/pages/api/auth/[...all].ts`

**Interfaces:**
- Produces `OAuthTokenBoundary.handle(request: Request): Promise<Response>` for only `POST` requests with `application/x-www-form-urlencoded` bodies to the OAuth token endpoint.
- Produces `MCP_RESOURCE_URL` as a required HTTPS production setting, distinct from `BETTER_AUTH_URL` when the token boundary is deployed separately.
- All ordinary Astro unsafe requests run with `security.checkOrigin: true`.

- [ ] **Step 1: Write failing boundary tests**

Cover: a valid form-encoded token request is forwarded; JSON, missing content type, non-POST, and non-token paths are rejected; no arbitrary `/api/auth/*` path can be forwarded; a cross-origin application `PATCH` remains rejected by Astro origin enforcement.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/auth/server/infrastructure/http/OAuthTokenController.test.ts`

Expected: FAIL because the boundary and controller do not exist.

- [ ] **Step 3: Implement the narrowly-scoped token boundary**

Implement `OAuthTokenBoundary` as the only adapter allowed to call Better Auth's token endpoint. Validate method, exact pathname and form media type before forwarding. Keep the resource-server endpoint `/mcp` outside this controller. Route the deployment's token URL to this controller/function and configure `BETTER_AUTH_URL`, issuer and JWKS URL explicitly when the authorization server is separate.

- [ ] **Step 4: Re-enable origin validation**

Set `security.checkOrigin: true` in `astro.config.mjs`. Remove the temporary exemption comment. Ensure `src/pages/api/auth/[...all].ts` no longer receives the token-exchange path if it would make Astro reject the standards-compliant request.

- [ ] **Step 5: Run focused tests and build**

Run: `npm test -- src/auth/server/infrastructure/http/OAuthTokenController.test.ts src/auth/server/infrastructure/better-auth/McpOAuthConfig.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add astro.config.mjs src/auth src/pages/api/auth src/pages/api/oauth CHANGELOG.md
git commit -m "fix(auth): isolate OAuth token exchange"
```

### Task 3: Pin MCP resource verification and modern transport behavior

**Files:**
- Modify: `src/pages/mcp.ts`
- Modify: `src/auth/server/infrastructure/better-auth/McpOAuthConfig.ts`
- Modify: `src/auth/server/infrastructure/better-auth/McpOAuthConfig.test.ts`
- Modify: `src/agents/server/infrastructure/mcp/createNanobookMcpServer.ts`
- Create: `src/agents/server/infrastructure/mcp/createNanobookMcpServer.test.ts`

**Interfaces:**
- `getMcpOAuthConfig(authOrigin: string, resourceUrl: string)` returns a canonical resource URL and rejects non-HTTPS production origins, query strings, credentials, and paths other than `/mcp`.
- `POST /mcp` accepts only the current Streamable HTTP MCP profile and rejects legacy session transport.

- [ ] **Step 1: Write failing configuration and transport tests**

Test that a resource URL with a non-`/mcp` path, query, fragment, credentials, or non-loopback HTTP is rejected. Test an MCP legacy initialize request is rejected while the current `tools/list` exchange succeeds. Test that malformed claims cannot reach a registered tool.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- src/auth/server/infrastructure/better-auth/McpOAuthConfig.test.ts src/agents/server/infrastructure/mcp/createNanobookMcpServer.test.ts`

Expected: FAIL because resource and transport behavior are not pinned by tests.

- [ ] **Step 3: Implement canonical resource and non-legacy transport**

Pass the canonical resource, issuer and JWKS configuration to `requireMcpAuth`. Replace `{ legacy: "stateless" }` with the SDK's current rejection mode after validating the installed SDK's type contract. Preserve JSON response mode. Do not add a fallback path for older MCP clients.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/auth/server/infrastructure/better-auth/McpOAuthConfig.test.ts src/agents/server/infrastructure/mcp/createNanobookMcpServer.test.ts src/agents/server/infrastructure/oauth/McpActorReader.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/mcp.ts src/auth/server/infrastructure/better-auth src/agents/server/infrastructure/mcp src/agents/server/infrastructure/oauth CHANGELOG.md
git commit -m "fix(mcp): pin protected resource transport"
```

### Task 4: Enforce least privilege and prove resource isolation

**Files:**
- Modify: `src/auth/server/infrastructure/better-auth/BetterAuth.ts`
- Modify: `src/agents/server/application/AgentToolService.ts`
- Modify: `src/agents/server/application/AgentToolService.test.ts`
- Modify: `src/nanobooks/server/application/RequireNanobookAccess.test.ts`
- Modify: `src/pages/consent.astro`
- Create: `src/pages/consent.test.ts`

**Interfaces:**
- Read-only authorization requests contain `nanobooks:read`; write access is explicitly requested only for write-capable MCP operations.
- `AgentToolService` maintains `has(actor, "nanobooks:read" | "nanobooks:write")` and continues to require `RequireNanobookAccess.execute(actorId, nanobookId, permission)` for any resource-bound tool.

- [ ] **Step 1: Write failing authorization tests**

Cover a read-only token attempting every write method, a write-scoped non-owner accessing a private nanobook, a public nanobook read by a non-owner, a missing resource, and a consent screen that displays exactly the requested scopes and verified client id.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/agents/server/application/AgentToolService.test.ts src/nanobooks/server/application/RequireNanobookAccess.test.ts src/pages/consent.test.ts`

Expected: FAIL for the missing scope-minimization and consent assertions.

- [ ] **Step 3: Implement the least-privilege grant policy**

Configure the OAuth request/challenge policy so unauthenticated discovery advertises only `nanobooks:read`; preserve `nanobooks:write` for explicit step-up authorization. Keep the consent page tied to Better Auth's signed OAuth query and render the verified requested scope list without accepting a client id or scope from an unsiged browser field.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/agents/server/application/AgentToolService.test.ts src/nanobooks/server/application/RequireNanobookAccess.test.ts src/pages/consent.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/server/infrastructure/better-auth/BetterAuth.ts src/agents/server/application src/nanobooks/server/application src/pages/consent.astro src/pages/consent.test.ts CHANGELOG.md
git commit -m "fix(agents): require least-privilege MCP grants"
```

### Task 5: Make security events auditable without exposing secrets

**Files:**
- Create: `src/agents/server/application/ports/AgentSecurityEventWriter.ts`
- Create: `src/agents/server/application/RecordAgentSecurityEvent.ts`
- Create: `src/agents/server/infrastructure/audit/DrizzleAgentSecurityEventWriter.ts`
- Create: `src/agents/server/infrastructure/audit/DrizzleAgentSecurityEventWriter.test.ts`
- Modify: `src/agents/server/infrastructure/database/DrizzleAgentAuditSchema.ts`
- Create: generated `drizzle/0014_agent_security_events.sql` and matching metadata
- Modify: `src/agents/server/index.ts`
- Modify: `src/pages/mcp.ts`

**Interfaces:**
- `AgentSecurityEventWriter.write(event: { actorId?: string; oauthClientId?: string; eventType: "authentication_denied" | "scope_denied" | "resource_denied" | "mutation_succeeded"; requestId: string; occurredAt: Date }): Promise<void>`.
- Event records never include Bearer tokens, refresh tokens, OAuth codes, tool arguments, Markdown, or raw error stacks.

- [ ] **Step 1: Write failing writer tests**

Assert that every event type persists only allowlisted fields, that a serialized row contains no token/content column, and that writer failure does not turn a successful domain mutation into an unreported second attempt.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/agents/server/infrastructure/audit/DrizzleAgentSecurityEventWriter.test.ts`

Expected: FAIL because the event writer and migration do not exist.

- [ ] **Step 3: Implement the event port, writer and migration**

Add the narrow event schema and a generated Drizzle migration. Emit denied events at the MCP/auth boundary and keep the existing `agent_operation_audit` for successful mutations. Use a generated correlation id per request and return it only in safe operational logs, not tool content.

- [ ] **Step 4: Run writer and route tests**

Run: `npm test -- src/agents/server/infrastructure/audit src/pages/mcp.test.ts`

Expected: PASS.

- [ ] **Step 5: Apply and verify the migration against a disposable database**

Run: `npm run database:migrate`

Expected: migrations apply once; a second run makes no schema changes.

- [ ] **Step 6: Commit**

```bash
git add src/agents drizzle CHANGELOG.md
git commit -m "feat(agents): audit MCP security events"
```

### Task 6: Production readiness, operational controls, and end-to-end acceptance

**Files:**
- Create: `docs/operations/mcp-production-runbook.md`
- Modify: `src/content/nanobook-project/production-readiness.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces a deploy checklist with required Vercel secret names, canonical origins, migration order, JWKS persistence, rollback, revocation, and incident contacts/owners.
- Produces an executable smoke-test matrix for login, consent, token refresh, revocation, read, write, domain denial, and `409` recovery.

- [ ] **Step 1: Write the acceptance matrix before deployment documentation**

Define test cases with exact expected statuses: no token `401`; missing write scope `403`; private foreign nanobook `403`; missing id `404`; stale document revision `409`; revoked refresh token rejected; expired access token rejected; restored backup preserves OAuth/JWKS/audit tables.

- [ ] **Step 2: Document deployment configuration and rollback**

Document `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_URL`, `MCP_RESOURCE_URL`, `BETTER_AUTH_SECRET`, mail secrets, GitHub OAuth callback, cache restrictions, migration command, backup restore verification and the procedure to disable MCP by removing the `/mcp` route at the edge while retaining normal login.

- [ ] **Step 3: Execute the staging checklist**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

On staging, execute every acceptance case from Step 1 and capture the request id plus redacted evidence in the deployment record.

- [ ] **Step 4: Commit documentation**

```bash
git add docs src/content/nanobook-project README.md CHANGELOG.md
git commit -m "docs(agents): add MCP production runbook"
```

## Self-review

- The temporary global origin bypass is owned by Task 2; it is the release-blocking remediation.
- Canonical resource/audience verification and rejection of legacy transport are owned by Task 3.
- Scope minimization, signed consent and per-resource authorization are owned by Task 4.
- Sensitive-data-safe observability and idempotency diagnosis are owned by Task 5.
- Secrets, persistence, migration, backup, revocation and production proof are owned by Task 6.
- The review-focus cases appear respectively in Tasks 2, 3, 4, 4 and 5/6.
- No task broadens the existing MCP capability set or adds destructive operations.
