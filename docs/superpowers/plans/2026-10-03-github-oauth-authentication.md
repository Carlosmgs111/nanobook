# GitHub OAuth Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a user to sign in or create an account through GitHub while preserving the existing email/password flow.

**Architecture:** Better Auth remains the sole server-side authentication boundary. A small server helper validates the two GitHub OAuth credentials and conditionally contributes the `github` provider to Better Auth. The login page receives a server-derived availability flag; its browser adapter starts Better Auth's `POST /api/auth/sign-in/social` flow and navigates only to the authorization URL returned by that API.

**Tech Stack:** Astro 7 SSR, TypeScript, Better Auth 1.7, Drizzle/libSQL, Vitest.

**Spec:** Approved bounded design from this conversation on 2026-10-03: GitHub OAuth only, conditional availability when credentials are configured, callback to `/`, email/password unchanged, documentation and tests included.

## Global Constraints

- Keep `emailAndPassword.enabled: true`; GitHub is an additional sign-in path, not a replacement.
- Store only `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` as server secrets; never expose the client secret to browser code.
- Use Better Auth's `/api/auth/callback/github` callback route and configure the GitHub OAuth App with the exact public base URL for each environment.
- Require the `user:email` GitHub scope; a private primary email otherwise causes the provider flow to fail.
- Preserve the user's uncommitted changes in `src/auth/browser/AuthFormComposer.ts`; reconcile the disabled post-email redirect explicitly rather than overwriting it incidentally.
- Maintain `CHANGELOG.md` under `[Unreleased]`; use Conventional Commits and run `npm run build` before committing.

## Review Focus

- Both GitHub credentials are absent: email/password login still works and the GitHub control is absent.
- Only one credential is configured: server startup fails with a configuration-specific error rather than exposing an unusable login button.
- The social-sign-in API returns an unexpected success payload: browser code reports an error and never navigates to `undefined`.
- The social-sign-in API returns an HTTP error: browser code reports Better Auth's message and restores the control.
- OAuth state cookie is missing or originated on a different host: the app reports `state_not_found` as a configuration/session problem; do not call the callback URL directly as a test.

---

## File Structure

- `astro.config.mjs` — declares the three auth/OAuth runtime variables for typed server imports.
- `src/auth/server/GitHubOAuth.ts` — pure validation and provider-configuration builder; has no Astro, database, or browser dependency.
- `src/auth/server/GitHubOAuth.test.ts` — verifies disabled, enabled, and incomplete-credential states.
- `src/auth/server/BetterAuth.ts` — composes the GitHub provider into Better Auth only after successful validation.
- `src/pages/login.astro` — determines whether GitHub is available on the server and passes that explicit capability to the form.
- `src/auth/browser/HttpAuthApi.ts` — extends the browser auth boundary with a typed social-sign-in operation that returns the Better Auth authorization URL.
- `src/auth/browser/HttpAuthApi.test.ts` — verifies the social endpoint payload, URL handling, and errors at the HTTP boundary.
- `src/auth/browser/AuthFormComposer.ts` — binds the GitHub control, provides loading/error feedback, and delegates navigation through injected capabilities.
- `src/auth/browser/AuthFormComposer.test.ts` — verifies user-visible social-login behavior using the real composer with narrow fakes at the HTTP/navigation boundary.
- `src/auth/browser/AuthForm.astro` — renders an accessible GitHub control only when enabled; it exposes no secret or provider configuration to the browser.
- `README.md` — documents the GitHub OAuth App setup and local/production callback URLs.
- `CHANGELOG.md` — records the feature in `[Unreleased]`.

### Task 1: Validate and compose GitHub provider configuration

**Files:**
- Create: `src/auth/server/GitHubOAuth.ts`
- Create: `src/auth/server/GitHubOAuth.test.ts`
- Modify: `astro.config.mjs`
- Modify: `src/auth/server/BetterAuth.ts`

**Interfaces:**
- Produces: `createGitHubOAuthProvider(credentials)` where `credentials` is `{ clientId?: string; clientSecret?: string }` and the return type is `{ clientId: string; clientSecret: string } | undefined`.
- Consumes: the secret `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` values from `astro:env/server`.
- Consumed by later tasks: `isGitHubOAuthEnabled(credentials)` returns whether the login page may render the provider control.

- [ ] **Step 1: Write the failing server configuration tests**

```ts
import { describe, expect, it } from "vitest";
import {
  createGitHubOAuthProvider,
  isGitHubOAuthEnabled,
} from "./GitHubOAuth";

describe("GitHub OAuth configuration", () => {
  it("does not enable GitHub when both credentials are absent", () => {
    expect(createGitHubOAuthProvider({})).toBeUndefined();
    expect(isGitHubOAuthEnabled({})).toBe(false);
  });

  it("enables GitHub only with its complete credential pair", () => {
    expect(
      createGitHubOAuthProvider({ clientId: "client-id", clientSecret: "client-secret" }),
    ).toEqual({ clientId: "client-id", clientSecret: "client-secret" });
  });

  it("rejects a partial GitHub OAuth configuration", () => {
    expect(() => createGitHubOAuthProvider({ clientId: "client-id" })).toThrow(
      "GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET must be configured together.",
    );
  });
});
```

- [ ] **Step 2: Run the new tests and verify they fail because the helper does not exist**

Run: `npm test -- src/auth/server/GitHubOAuth.test.ts`

Expected: FAIL with an unresolved `./GitHubOAuth` import.

- [ ] **Step 3: Implement the smallest pure helper**

```ts
export interface GitHubOAuthCredentials {
  clientId?: string;
  clientSecret?: string;
}

export interface GitHubOAuthProvider {
  clientId: string;
  clientSecret: string;
}

export function createGitHubOAuthProvider(
  credentials: GitHubOAuthCredentials,
): GitHubOAuthProvider | undefined {
  const { clientId, clientSecret } = credentials;
  if (!clientId && !clientSecret) return undefined;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET must be configured together.",
    );
  }
  return { clientId, clientSecret };
}

export function isGitHubOAuthEnabled(credentials: GitHubOAuthCredentials): boolean {
  return createGitHubOAuthProvider(credentials) !== undefined;
}
```

- [ ] **Step 4: Declare and use the server-only variables**

Add optional secret fields `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, and `BETTER_AUTH_URL` to `astro.config.mjs`. In `BetterAuth.ts`, import the first two from `astro:env/server`, call the helper, and set `socialProviders: provider ? { github: provider } : undefined`. Set Better Auth's `baseURL` from `BETTER_AUTH_URL` only when it is provided, so local request-origin resolution remains available.

- [ ] **Step 5: Run the focused tests and type/build check**

Run: `npm test -- src/auth/server/GitHubOAuth.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: exit code 0 and Astro completes its server build.

- [ ] **Step 6: Commit the server configuration unit**

```bash
git add astro.config.mjs src/auth/server/BetterAuth.ts src/auth/server/GitHubOAuth.ts src/auth/server/GitHubOAuth.test.ts
git commit -m "feat(auth): configure GitHub OAuth provider"
```

### Task 2: Add a browser boundary for Better Auth social sign-in

**Files:**
- Modify: `src/auth/browser/HttpAuthApi.ts`
- Modify: `src/auth/browser/HttpAuthApi.test.ts`

**Interfaces:**
- Consumes: `POST /api/auth/sign-in/social` with `{ provider: "github", callbackURL: "/", disableRedirect: true }`.
- Produces: `AuthApi.signInWithGitHub(): Promise<{ authorizationUrl: string }>`.
- Consumed by Task 3: the form composer starts an external browser navigation only after receiving `authorizationUrl`.

**Current baseline:** `src/auth/browser/HttpAuthApi.test.ts` already fails in the current checkout because its tests pass a fetch double as the constructor's first argument while `HttpAuthApi` currently interprets that argument as `baseUrl`. Task 2 deliberately resolves this mismatch as part of introducing an injectable `FetchLike`; do not treat those failures as caused by GitHub OAuth.

- [ ] **Step 1: Preserve the failing HTTP-boundary contract and add social cases**

```ts
it("returns Better Auth's GitHub authorization URL without following it", async () => {
  const api = new HttpAuthApi(async () =>
    new Response(
      JSON.stringify({ redirect: true, url: "https://github.com/login/oauth/authorize?state=signed" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );

  await expect(api.signInWithGitHub()).resolves.toEqual({
    authorizationUrl: "https://github.com/login/oauth/authorize?state=signed",
  });
});

it("rejects a successful social response without an authorization URL", async () => {
  const api = new HttpAuthApi(async () =>
    new Response(JSON.stringify({ redirect: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  await expect(api.signInWithGitHub()).rejects.toEqual(
    new AuthApiError("Respuesta de autenticación inválida.", 200),
  );
});
```

Assert this exact request in the new test:

```ts
expect(requests).toEqual([
  {
    input: "/api/auth/sign-in/social",
    init: expect.objectContaining({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({
        provider: "github",
        callbackURL: "/",
        disableRedirect: true,
      }),
    }),
  },
]);
```

- [ ] **Step 2: Run the focused tests and verify the expected red state**

Run: `npm test -- src/auth/browser/HttpAuthApi.test.ts`

Expected: FAIL because the pre-existing fetch-double constructor contract is unsupported and `signInWithGitHub` is not declared.

- [ ] **Step 3: Make the HTTP adapter testable and add the minimal social method**

Introduce a `FetchLike` constructor dependency with `globalThis.fetch` as the default; preserve the existing optional `baseUrl` behavior. Add `signInWithGitHub`, issue the request from Step 1, and return a typed URL only when `payload.redirect === true` and `payload.url` is a non-empty string. Reuse the current JSON parsing, but rethrow an existing `AuthApiError` unchanged before wrapping only network/JSON failures; this restores the existing API-error contract. Remove the `console.log({ payload })` diagnostic because it can expose provider payloads in production logs.

- [ ] **Step 4: Run the focused HTTP tests**

Run: `npm test -- src/auth/browser/HttpAuthApi.test.ts`

Expected: PASS, including email sign-in, email registration, social payload, malformed social payload, and HTTP-error tests.

- [ ] **Step 5: Commit the browser HTTP unit**

```bash
git add src/auth/browser/HttpAuthApi.ts src/auth/browser/HttpAuthApi.test.ts
git commit -m "feat(auth): start GitHub OAuth from browser boundary"
```

### Task 3: Render and orchestrate the GitHub login control

**Files:**
- Modify: `src/pages/login.astro`
- Modify: `src/auth/browser/AuthForm.astro`
- Modify: `src/auth/browser/AuthFormComposer.ts`
- Modify: `src/auth/browser/AuthFormComposer.test.ts`

**Interfaces:**
- Consumes: `isGitHubOAuthEnabled` from Task 1 and `AuthApi.signInWithGitHub` from Task 2.
- Produces: an accessible button, `data-auth-provider="github"`, rendered only when the server has a complete provider configuration.
- User-visible behavior: a click disables the provider control, announces loading through `ToastNotifier`, then calls injected `navigate(authorizationUrl)`; failures announce an error and re-enable it.

- [ ] **Step 1: Write the failing composer tests**

Extend the fake `AuthApi` with `githubAuthorizationUrl = "https://github.com/login/oauth/authorize?state=signed"` and `signInWithGitHub`. Then add:

```ts
it("navigates to GitHub only after the social authorization URL is returned", async () => {
  const view = createForm();
  const destinations: string[] = [];
  const composer = new AuthFormComposer({
    root: view.root as unknown as HTMLElement,
    authApi: new FakeAuthApi(),
    notifier: { show() {} },
    navigate: (path) => destinations.push(path),
  });

  composer.mount();
  await view.githubButton.trigger("click");

  expect(destinations).toEqual([
    "https://github.com/login/oauth/authorize?state=signed",
  ]);
});

it("restores the GitHub control when social sign-in fails", async () => {
  const view = createForm();
  const authApi = new FakeAuthApi();
  authApi.error = new Error("GitHub no está disponible.");
  const composer = new AuthFormComposer({
    root: view.root as unknown as HTMLElement,
    authApi,
    notifier: { show() {} },
    navigate: () => {},
  });

  composer.mount();
  await view.githubButton.trigger("click");

  expect(view.githubButton.disabled).toBe(false);
});
```

- [ ] **Step 2: Run the composer test and verify it fails because the provider control is absent**

Run: `npm test -- src/auth/browser/AuthFormComposer.test.ts`

Expected: FAIL because `githubButton` and social orchestration do not exist.

- [ ] **Step 3: Pass the availability capability from server to UI**

In `login.astro`, import the two GitHub credential variables and `isGitHubOAuthEnabled`, then render `<AuthForm githubEnabled={...} />`. Add `githubEnabled?: boolean` to the Astro component props and render a `type="button"` GitHub control only when true. Give it a descriptive accessible label such as `Continuar con GitHub`; keep it outside the email/password `<form>` so it cannot submit credentials.

- [ ] **Step 4: Implement minimal composer orchestration**

During `mount`, subscribe to `[data-auth-provider="github"]`. Add a dedicated `submitGitHub` method that calls `authApi.signInWithGitHub`, shows a loading toast, disables that control while in flight, and invokes the existing injected `navigate` with the returned authorization URL. On error it must use the existing normalized error message and re-enable the control. Do not re-enable the control after successful navigation. Reconcile the existing email/password navigation test with the user's current local change: preserve its intentional state and document any needed expectation update rather than silently restoring the commented timeout.

- [ ] **Step 5: Run all authentication browser tests**

Run: `npm test -- src/auth/browser/HttpAuthApi.test.ts src/auth/browser/AuthFormComposer.test.ts`

Expected: PASS with no console diagnostics.

- [ ] **Step 6: Commit the UI unit without staging unrelated local work**

```bash
git add src/pages/login.astro src/auth/browser/AuthForm.astro src/auth/browser/AuthFormComposer.ts src/auth/browser/AuthFormComposer.test.ts
git commit -m "feat(auth): add GitHub sign-in control"
```

### Task 4: Document deployment, verify the real OAuth callback, and record the release note

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: the callback path supplied by Better Auth, `/api/auth/callback/github`.
- Produces: reproducible GitHub OAuth App configuration for development and production.

- [ ] **Step 1: Add deployment guidance**

Add an **Autenticación con GitHub** section to `README.md` with this configuration template:

```text
BETTER_AUTH_URL=http://localhost:4322
GITHUB_OAUTH_CLIENT_ID=your-github-oauth-client-id
GITHUB_OAUTH_CLIENT_SECRET=your-github-oauth-client-secret
```

Document these callback values exactly:

```text
Local:      http://localhost:4322/api/auth/callback/github
Production: https://<your-domain>/api/auth/callback/github
```

State that GitHub OAuth App settings must request `user:email`, production must use HTTPS, and `BETTER_AUTH_URL`, the visited origin, and the configured callback host must agree.

- [ ] **Step 2: Record the feature**

Under `[Unreleased]` in `CHANGELOG.md`, add a concise entry that GitHub OAuth can be enabled through the two OAuth credential variables and that email/password remains available.

- [ ] **Step 3: Perform the controlled manual OAuth verification**

1. Configure a disposable GitHub OAuth App with the local callback URL and both local secrets.
2. Start `npm run dev` and open `http://localhost:4322/login` in one browser profile.
3. In a clean process without the two GitHub OAuth credentials, open `/login` and verify that the GitHub control is absent while email/password continues to submit normally.
4. Restart with the complete credentials, select **Continuar con GitHub**, complete authorization, and verify the browser returns to `/` with a Better Auth session cookie and an `account` record whose `provider_id` is `github`.
5. Repeat with an existing email/password user whose GitHub email matches; verify Better Auth's configured account-linking policy yields one user, not two.
6. If `/api/auth/error?error=state_not_found` appears, capture the initiating origin, response `Set-Cookie`, callback host, and `BETTER_AUTH_URL`; correct host/scheme mismatches or blocked cookies. Do not attempt to open the callback URL manually, since it has no signed state cookie and will correctly return that error.

- [ ] **Step 4: Run final automated verification**

Run: `npm test`

Expected: exit code 0 with all Vitest files passing.

Run: `npm run build`

Expected: exit code 0 with the Astro server build complete.

- [ ] **Step 5: Commit documentation only after verification**

```bash
git add README.md CHANGELOG.md
git commit -m "docs(auth): document GitHub OAuth setup"
```

## Plan Self-Review

- **Spec coverage:** Tasks 1–3 implement conditional server configuration, the browser OAuth initiation flow, a GitHub-only UI control, return to `/`, and preservation of email/password. Task 4 documents setup and adds the changelog. No schema migration is required because the existing Better Auth `account` table already persists provider accounts.
- **OAuth error coverage:** The plan treats the observed `state_not_found` route as an integration symptom, not proof of a code defect. Task 4 verifies the only valid flow: state generation, the same browser's cookie, and the callback on the same configured origin.
- **Test coverage:** Task 1 covers credential state; Task 2 covers the exact API payload, malformed success, and HTTP errors; Task 3 covers navigation and error recovery. Task 4 manually verifies conditional rendering, cookies, and the external GitHub callback, which cannot be reproduced faithfully in a unit test.
- **Type consistency:** `createGitHubOAuthProvider`, `isGitHubOAuthEnabled`, and `AuthApi.signInWithGitHub` are defined before their consumers; the social API returns `{ authorizationUrl: string }` throughout the browser boundary.
- **Placeholder scan:** No deferred implementation steps or unspecified interfaces remain. The only environment-specific value is intentionally represented as `<your-domain>` because it is deployment-owned, not an application default.
