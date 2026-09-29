# User Profile UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the dedicated `/profile` page for the current user's profile, with accessible loading/editing/error states and a client controller backed exclusively by `HttpUserApi`.

**Architecture:** Keep the route and Astro components responsible for structure and server-provided identity, while a pure client-side controller owns profile state transitions and calls the existing HTTP output adapter. `Astro.locals.currentUserId` is the only identity seam; when it is absent, the page renders an unavailable state and makes no API request. The global header links to `/profile`, but the profile form remains an independent page rather than a modal or dashboard.

**Tech Stack:** Astro 7, TypeScript, Tailwind CSS 4, Vitest 4, existing `HttpUserApi`, Astro `ClientRouter`, existing Nanobook layout and theme tokens.

**Spec:** `docs/superpowers/specs/2026-09-29-user-profile-ui-design.md`

## Global Constraints

- The profile is a dedicated page at `/profile`; no dashboard, modal, or sidebar panel is the primary surface.
- The route reads `Astro.locals.currentUserId`; if it is absent, it renders an unavailable state and performs no API call.
- There is no fallback through email, `localStorage`, public configuration, or a hardcoded ID.
- The frontend uses `HttpUserApi`; UI code must not call `fetch` directly.
- The form must never send `id`, `createdAt`, or `updatedAt`.
- The page must preserve edited values after a save error and prevent duplicate submissions while saving.
- Visible focus, associated labels, `aria-live` feedback, keyboard operation, and mobile layout are required.
- Before any commit or tag, run `npm run build`; update `CHANGELOG.md` under `[Unreleased]`.

## Review Focus

- Missing current identity: `/profile` must show unavailable access and make zero API calls; covered by the route/component contract test or controller mount test.
- Late or duplicate lifecycle events: `astro:page-load` and `astro:before-swap` must not leave duplicate submit listeners; covered by the mount/cleanup test.
- Save failure with edited data: draft values must remain intact and retry must issue one request; covered in `UserProfileController.test.ts`.
- API errors by status: 400, 404, 409, and network failure must produce actionable user-facing messages; covered in controller state tests.
- Responsive/accessibility regressions: fields need labels, live status, disabled saving state, and no hover-only action; covered by component markup assertions and build verification.

---

## File Map

Create:

- `src/env.d.ts` — declares `App.Locals.currentUserId?: string` without implementing authentication.
- `src/user/client/profile-controller.ts` — pure profile state machine and `mountUserProfileForm` browser bridge.
- `src/user/client/profile-controller.test.ts` — state, validation, save, error, retry, and cleanup tests.
- `src/user/ui/pages/UserProfilePage.astro` — page-level composition and unavailable state.
- `src/user/ui/components/UserProfileForm.astro` — semantic editable form and client mount point.
- `src/user/ui/components/ProfileStatus.astro` — loading, success, validation, and error feedback markup.
- `src/user/ui/UserProfileComponents.test.ts` — static selector and accessibility contract tests for the Astro components.
- `src/pages/profile.astro` — dedicated route using `Layout.astro` and `Astro.locals.currentUserId`.

Modify:

- `src/layouts/Layout.astro` — pass the profile link option through the layout contract.
- `src/layouts/components/LayoutShell.astro` — forward profile link to the header.
- `src/layouts/components/Header.astro` — render an accessible `Perfil` link.
- `src/layouts/components/Header.test.ts` — static header-link contract test.
- `src/content/nanobook-project/arquitectura/modulo-user.md` — document the UI flow and identity seam.
- `CHANGELOG.md` — add the profile UI under `[Unreleased]`.

Do not modify authentication middleware or create a fake current-user provider. The page must work with a test fixture or future session middleware supplying `Astro.locals.currentUserId`.

## Interfaces

Task 1 produces the exact controller contracts consumed by the Astro form:

```ts
export type ProfilePhase =
  | "loading"
  | "ready"
  | "saving"
  | "saved"
  | "load-error"
  | "save-error";

export interface UserProfileUiState {
  phase: ProfilePhase;
  profile: UserProfile | null;
  draft: { email: string; displayName: string };
  message: string | null;
}

export class UserProfileController {
  constructor(api: UserProfileClient, userId: string, onStateChange: (state: UserProfileUiState) => void);
  getState(): UserProfileUiState;
  load(): Promise<void>;
  save(draft: { email: string; displayName: string }): Promise<void>;
  retry(): Promise<void>;
}

export function mountUserProfileForm(root: HTMLElement, userId: string, api?: UserProfileClient): () => void;
```

`UserProfileClient` is the minimal structural port containing `getUser(id)` and `updateUser(id, input)`, satisfied by `HttpUserApi`. The controller maps error status `400` to validation feedback, `404` to unavailable profile, `409` to email conflict, and status `0` to a network retry message.

```ts
export interface UserProfileClient {
  getUser(id: string): Promise<Result<HttpUserApiError, UserProfile>>;
  updateUser(
    id: string,
    input: { email?: string; displayName?: string }
  ): Promise<Result<HttpUserApiError, UserProfile>>;
}
```

### Task 1: Model profile UI state and client lifecycle

**Files:**
- Create: `src/user/client/profile-controller.ts`
- Test: `src/user/client/profile-controller.test.ts`

**Interfaces:**
- Consumes: `HttpUserApi`-compatible `getUser` and `updateUser` methods and `UserProfile`.
- Produces: `ProfilePhase`, `UserProfileUiState`, `UserProfileController`, `mountUserProfileForm`, and `UserProfileClient` as defined above.

- [ ] **Step 1: Write failing state-transition tests**

Use a fake client with deferred `getUser`/`updateUser` promises. Assert the initial `loading` state, successful load to `ready`, draft initialization, successful save to `saved`, and that the saved response replaces the draft.

```ts
it("loads the current profile and saves the server response", async () => {
  const client = fakeClient({
    profile: profile("user-1", "old@example.com", "Old"),
    updated: profile("user-1", "new@example.com", "New"),
  });
  const states: UserProfileUiState[] = [];
  const controller = new UserProfileController(client, "user-1", (state) => states.push(state));

  await controller.load();
  await controller.save({ email: "new@example.com", displayName: "New" });

  expect(states.map((state) => state.phase)).toEqual(["loading", "ready", "saving", "saved"]);
  expect(controller.getState().profile?.email).toBe("new@example.com");
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/user/client/profile-controller.test.ts`

Expected: FAIL because `profile-controller.ts` does not exist.

- [ ] **Step 3: Implement the minimal controller**

Initialize with `phase: "loading"`, call `api.getUser(userId)` exactly once per `load`, copy the returned profile into both `profile` and `draft`, and reject blank `email` or `displayName` locally with `save-error` without calling the API. On save, emit `saving`, call `updateUser` with only `{ email, displayName }`, preserve the draft on failure, and emit `saved` with the server response on success.

- [ ] **Step 4: Add status mapping, retry, and lifecycle cleanup tests**

Cover 400, 404, 409, and status-0 errors; verify `retry()` returns to `loading` and invokes one new load; verify `mountUserProfileForm` removes its submit/listener callbacks when the returned cleanup function runs.

- [ ] **Step 5: Implement the browser bridge**

`mountUserProfileForm(root, userId, api = new HttpUserApi())` must find `form`, `input[name="email"]`, `input[name="displayName"]`, `button[type="submit"]`, and `[data-profile-status]`; subscribe to controller state, update values/status/disabled state, register one submit handler, call `load()`, and return cleanup that removes the handler and unsubscribes state updates. It must not register listeners at module import time.

- [ ] **Step 6: Run the focused tests and verify success**

Run: `npm test -- src/user/client/profile-controller.test.ts`

Expected: PASS with all state and cleanup cases.

- [ ] **Step 7: Commit the client state slice**

```bash
git add src/user/client/profile-controller.ts src/user/client/profile-controller.test.ts
git commit -m "feat(user): add profile UI controller"
```

### Task 2: Build the accessible profile components and route

**Files:**
- Create: `src/env.d.ts`
- Create: `src/user/ui/pages/UserProfilePage.astro`
- Create: `src/user/ui/components/UserProfileForm.astro`
- Create: `src/user/ui/components/ProfileStatus.astro`
- Create: `src/pages/profile.astro`

**Interfaces:**
- Consumes: `currentUserId?: string` from `profile.astro` and `mountUserProfileForm` from Task 1.
- Produces: a `/profile` page with `data-profile-root`, `data-user-id`, named inputs, status region, and form semantics required by `mountUserProfileForm`.

- [ ] **Step 1: Write the component contract test**

In `src/user/ui/UserProfileComponents.test.ts`, read the component source files with `readFileSync` and assert the stable contract: `UserProfileForm.astro` contains `form`, `name="email"`, `name="displayName"`, `data-profile-status`, `aria-live="polite"`, `for="profile-email"`, `for="profile-display-name"`, and `type="submit"`; `UserProfilePage.astro` contains the `currentUserId` conditional and an unavailable message. This pins the selectors shared with the controller while Astro build verification checks compilation.

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- src/user/ui/UserProfileComponents.test.ts`

Expected: FAIL because the Astro components and route do not exist.

- [ ] **Step 3: Implement `src/env.d.ts` and the route**

Declare:

```ts
declare namespace App {
  interface Locals {
    currentUserId?: string;
  }
}
```

In `profile.astro`, read `Astro.locals.currentUserId`, set `prerender = false`, and render `UserProfilePage currentUserId={currentUserId}` inside `Layout` with title `Perfil de usuario`, description, and `hideToc={true}`. Do not call `HttpUserApi` from the server route.

- [ ] **Step 4: Implement the unavailable and ready branches**

`UserProfilePage.astro` renders an explanatory access-unavailable section when `currentUserId` is absent. When present, render a constrained profile card with `UserProfileForm userId={currentUserId}`. `UserProfileForm.astro` renders the semantic form, skeleton-ready initial state, fields, save button, and a module script that calls `mountUserProfileForm(root, userId)` on `astro:page-load` and cleanup on `astro:before-swap`.

- [ ] **Step 5: Implement status and accessibility markup**

`ProfileStatus.astro` must render the current message in `[data-profile-status]` with `role="status"` and `aria-live="polite"`. Use visible `<label for>` elements, `autocomplete="email"` and `autocomplete="name"`, `required`, `aria-describedby`, and a focusable retry button for load errors.

- [ ] **Step 6: Run the component/build verification**

Run: `npm run build`

Expected: PASS and the generated route includes `/profile` without requiring a session provider at build time.

### Task 3: Integrate the profile link into the global layout

**Files:**
- Modify: `src/layouts/Layout.astro`
- Modify: `src/layouts/components/LayoutShell.astro`
- Modify: `src/layouts/components/Header.astro`
- Test: `src/layouts/components/Header.test.ts`

**Interfaces:**
- Consumes: the existing layout props and `/profile` route.
- Produces: one accessible `Perfil` link with `href="/profile"`, visible in desktop and mobile header layouts without altering document controls.

- [ ] **Step 1: Write the failing header assertion**

In `src/layouts/components/Header.test.ts`, read `Header.astro`, `LayoutShell.astro`, and `Layout.astro` with `readFileSync`; assert that `Header.astro` consumes `profileHref`, contains one profile link with accessible `Perfil` text, and both parent files forward the prop.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/layouts/components/Header.test.ts`

Expected: FAIL because the header has no profile link.

- [ ] **Step 3: Thread the prop and render the link**

Add `profileHref?: string` through `Layout` → `LayoutShell` → `Header`, default it to `/profile` for the main layout, and render an icon/text link adjacent to the existing controls. Keep it keyboard-focusable, preserve the current spacing, and avoid adding profile logic to `DocumentControls`.

- [ ] **Step 4: Run the focused test and build**

Run: `npm test -- src/layouts/components/Header.test.ts && npm run build`

Expected: PASS; all existing document pages continue to compile with the new default prop.

### Task 4: Document and verify the complete profile UI

**Files:**
- Modify: `src/content/nanobook-project/arquitectura/modulo-user.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Document the implemented route and identity seam**

Add the final component paths, `/profile` flow, `Astro.locals.currentUserId` requirement, unavailable state, and explicit exclusion of authentication/session implementation.

- [ ] **Step 2: Add the Unreleased changelog entry**

Record the dedicated profile page, accessible states, global header link, and `HttpUserApi`-backed editing flow under the existing user entries.

- [ ] **Step 3: Run the complete test suite**

Run: `npm run test`

Expected: PASS for all existing and new tests.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: PASS; only existing Astro/Vite deprecation or chunk-size warnings may remain.

- [ ] **Step 5: Verify frontend boundaries and diff hygiene**

Run: `rg -n "fetch\\(" src/user/ui src/user/client/profile-controller.ts; git diff --check; git status --short`

Expected: no direct `fetch` calls in UI/controller code, no whitespace errors, and only intended profile UI changes plus any pre-existing unrelated working-tree changes.
