# User Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `user` domain module that models stable user identity and profile data, exposes testable application use cases, persists users through a replaceable repository, and is composed by `Application` without coupling the domain to Astro or a specific database.

**Architecture:** Follow the existing bounded-module pattern used by `document`: pure domain entities and ports under `src/user/domain`, application use cases under `src/user/application`, concrete persistence under `src/user/infraestructure`, and a `src/user/index.ts` composition root. `Application.create()` owns module construction and exposes the composed `UserModule`; routes or future authentication adapters depend on the module's public contracts rather than on infrastructure classes.

**Tech Stack:** Astro 7, TypeScript, Vitest 4, Zod 4, existing `Result` type, existing `EventBus` abstraction, Node 22.

**Spec:** `docs/superpowers/specs/2026-09-29-user-module-design.md` (created as the first task from the scope and contracts below).

## Global Constraints

- Preserve the current domain layout: `domain`, `application`, `infraestructure`, and `index.ts` composition roots.
- `src/user/domain` must not import Astro, `astro:env`, filesystem APIs, HTTP clients, browser APIs, or concrete repositories.
- User identity is an opaque stable `UserId`; email is a mutable, normalized lookup attribute and must not be used as the primary identity.
- The initial module manages profile data only; authentication providers, password storage, sessions, roles, permissions, and authorization middleware are not implemented by this plan.
- Repository methods return the existing `Result` abstraction with typed domain/infrastructure errors instead of leaking provider exceptions.
- Every behavior change must include Vitest coverage and `npm run test`; before any commit or tag, run `npm run build` as required by `AGENTS.md`.
- Add all user-module changes to `CHANGELOG.md` under `[Unreleased]` using Conventional Commit scope `user` if commits are created.

## Review Focus

- Email normalization and uniqueness: equivalent casing/whitespace must resolve to one user and duplicate creation must fail deterministically; covered in `CreateUser.test.ts` and repository tests.
- Stable identity versus mutable profile: changing email or display name must preserve `UserId`; covered in `UpdateUser.test.ts`.
- Missing records: get/update/delete must return typed not-found results rather than `undefined` or provider errors; covered in each application test.
- Invalid input: blank display names, malformed emails, and unsupported field updates must be rejected before persistence; covered in `User.test.ts` and DTO validation tests.
- Module composition: `Application.create()` must expose one shared `UserModule` and preserve existing document/navigation/publishing initialization; covered in `Application.test.ts` or a focused composition test.

---

## File Map

Create the following files:

- `docs/superpowers/specs/2026-09-29-user-module-design.md` — durable design decision and explicit initial scope.
- `src/user/domain/UserId.ts` — opaque stable identifier value object.
- `src/user/domain/User.ts` — user entity, normalization, and profile invariants.
- `src/user/domain/errors.ts` — typed user-domain errors.
- `src/user/domain/ports/UserRepository.ts` — persistence contract.
- `src/user/domain/types.ts` — serializable user/profile contracts.
- `src/user/application/dto/CreateUserRequest.ts` — create input.
- `src/user/application/dto/UpdateUserRequest.ts` — mutable profile input.
- `src/user/application/CreateUser.ts` — create use case.
- `src/user/application/GetUser.ts` — lookup by ID.
- `src/user/application/GetUserByEmail.ts` — lookup by normalized email.
- `src/user/application/UpdateUser.ts` — profile update use case.
- `src/user/application/DeleteUser.ts` — deletion use case.
- `src/user/application/errors.ts` — application-level conflict/not-found errors where needed.
- `src/user/infraestructure/errors.ts` — repository/infrastructure errors.
- `src/user/infraestructure/repository/InMemoryUserRepository.ts` — deterministic adapter for tests and local composition.
- `src/user/infraestructure/repository/index.ts` — repository factory.
- `src/user/index.ts` — public exports and `UserModule.create()`.
- `src/user/domain/User.test.ts`, `src/user/application/*.test.ts`, and `src/user/infraestructure/repository/InMemoryUserRepository.test.ts` — behavior and adapter tests.

Modify:

- `src/Application.ts` — compose and expose `userModule` without changing existing modules' contracts.
- `CHANGELOG.md` — document the new module under `[Unreleased]`.

Do not modify Astro routes, content schemas, or authentication middleware in this first increment; no user-facing route is specified yet.

## Interfaces

The plan uses these contracts consistently:

```ts
export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface UserRepository {
  getById(id: UserId): Promise<Result<UserRepositoryError, User | null>>;
  getByEmail(email: string): Promise<Result<UserRepositoryError, User | null>>;
  create(user: User): Promise<Result<UserRepositoryError, void>>;
  update(user: User): Promise<Result<UserRepositoryError, void>>;
  delete(id: UserId): Promise<Result<UserRepositoryError, void>>;
}

export class UserModule {
  static async create(eventBus?: EventBus): Promise<UserModule>;
  constructor(
    public readonly createUser: CreateUser,
    public readonly getUser: GetUser,
    public readonly getUserByEmail: GetUserByEmail,
    public readonly updateUser: UpdateUser,
    public readonly deleteUser: DeleteUser
  );
}
```

Use case methods receive request DTOs and return `Result<Error, UserProfile>` (or `Result<Error, void>` for delete). Controllers and HTTP DTOs are deliberately deferred until a user route and authentication boundary are specified.

### Task 1: Record the scope and design decision

**Files:**
- Create: `docs/superpowers/specs/2026-09-29-user-module-design.md`
- Create: `src/content/nanobook-project/arquitectura/modulo-user.md`

**Interfaces:**
- Produces the scope and contracts consumed by every later task.

- [ ] **Step 1: Write the design document**

Document the module boundary, entity fields, normalization rules, repository contract, error taxonomy, composition-root flow, and explicit non-goals. Include this dependency direction:

```text
Application
  └── UserModule
      ├── application use cases
      ├── domain User/UserId/ports
      └── infrastructure repository
```

- [ ] **Step 2: Add the project architecture note**

Explain why user profile data belongs in a separate bounded module and why authentication/session/authorization are deferred rather than embedded in `document` or `shared`.

- [ ] **Step 3: Verify documentation links and frontmatter**

Run: `rg -n "modulo-user|UserModule|UserRepository" docs/superpowers/specs/2026-09-29-user-module-design.md src/content/nanobook-project/arquitectura/modulo-user.md`

Expected: both documents contain the same module name and public contract names.

### Task 2: Implement the pure user domain

**Files:**
- Create: `src/user/domain/UserId.ts`
- Create: `src/user/domain/User.ts`
- Create: `src/user/domain/types.ts`
- Create: `src/user/domain/errors.ts`
- Test: `src/user/domain/User.test.ts`

**Interfaces:**
- Produces `UserId.create(value?: string)`, `User.create(input)`, `user.updateProfile(input)`, `user.toProfile()`, and `user.getId()`.
- Consumes only `Result` and standard platform types.

- [ ] **Step 1: Write failing tests for identity and invariants**

Cover generated IDs, preservation of an explicitly supplied valid ID, email trimming/lowercasing, rejection of malformed email and blank display name, immutable `createdAt`, mutable `updatedAt`, and stable ID after profile updates.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/user/domain/User.test.ts`

Expected: FAIL because the user domain files do not exist.

- [ ] **Step 3: Implement the minimal value object and entity**

Use `crypto.randomUUID()` for generated IDs, validate opaque non-empty IDs, normalize emails with `trim().toLowerCase()`, and return typed `InvalidUserError`/`InvalidUserIdError` through `Result`.

- [ ] **Step 4: Run the focused test and verify success**

Run: `npm test -- src/user/domain/User.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the domain slice**

```bash
git add src/user/domain
git commit -m "feat(user): add user identity and profile domain"
```

### Task 3: Define the repository port and in-memory adapter

**Files:**
- Create: `src/user/domain/ports/UserRepository.ts`
- Create: `src/user/infraestructure/errors.ts`
- Create: `src/user/infraestructure/repository/InMemoryUserRepository.ts`
- Create: `src/user/infraestructure/repository/index.ts`
- Test: `src/user/infraestructure/repository/InMemoryUserRepository.test.ts`

**Interfaces:**
- Consumes `User`, `UserId`, `Result`, and the domain error types.
- Produces `UserRepository` with ID/email lookup, create, update, and delete operations.

- [ ] **Step 1: Write failing adapter tests**

Test create/read/update/delete, normalized email lookup, duplicate normalized email rejection, replacement by stable ID, and missing-record behavior.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/user/infraestructure/repository/InMemoryUserRepository.test.ts`

Expected: FAIL because the port and adapter are absent.

- [ ] **Step 3: Implement the adapter**

Use private `Map<string, User>` and `Map<string, string>` indexes. Update the email index atomically: remove the old normalized email, reject collisions, then store the new user. Return typed `UserRepositoryError` for storage failures and `UserEmailAlreadyExistsError` for conflicts.

- [ ] **Step 4: Run the focused test and verify success**

Run: `npm test -- src/user/infraestructure/repository/InMemoryUserRepository.test.ts`

Expected: PASS.

### Task 4: Implement application use cases

**Files:**
- Create: `src/user/application/dto/CreateUserRequest.ts`
- Create: `src/user/application/dto/UpdateUserRequest.ts`
- Create: `src/user/application/errors.ts`
- Create: `src/user/application/CreateUser.ts`
- Create: `src/user/application/GetUser.ts`
- Create: `src/user/application/GetUserByEmail.ts`
- Create: `src/user/application/UpdateUser.ts`
- Create: `src/user/application/DeleteUser.ts`
- Test: `src/user/application/CreateUser.test.ts`
- Test: `src/user/application/GetUser.test.ts`
- Test: `src/user/application/GetUserByEmail.test.ts`
- Test: `src/user/application/UpdateUser.test.ts`
- Test: `src/user/application/DeleteUser.test.ts`

**Interfaces:**
- Consumes `UserRepository` and the domain factory/entity methods.
- Produces `execute(request)` methods matching the public module contract and maps repository/domain failures to typed application results.

- [ ] **Step 1: Write failing use-case tests**

Test successful create and return mapping, duplicate email conflict, get by ID, get by email, update preserving identity and creation time, update of a missing user, delete success, and delete of a missing user.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- src/user/application`

Expected: FAIL because the use cases do not exist.

- [ ] **Step 3: Implement DTOs and use cases**

Each use case must validate through the domain, call exactly the required repository operation, and return `UserProfile` rather than leaking the entity. `GetUser` and `GetUserByEmail` convert a `null` repository result into `UserNotFoundError`; `UpdateUser` loads by ID, applies only `email`/`displayName`, then persists; `DeleteUser` verifies existence before deleting.

- [ ] **Step 4: Run the focused tests and verify success**

Run: `npm test -- src/user/application`

Expected: PASS.

- [ ] **Step 5: Commit the application slice**

```bash
git add src/user/application
git commit -m "feat(user): add profile management use cases"
```

### Task 5: Add the user composition root and application integration

**Files:**
- Create: `src/user/index.ts`
- Modify: `src/Application.ts`
- Test: `src/user/index.test.ts`
- Test: `src/Application.test.ts` or the repository's existing composition test location.

**Interfaces:**
- Consumes the in-memory repository factory and all application use cases.
- Produces `getApp().userModule` with one repository-backed instance per application composition.

- [ ] **Step 1: Write failing composition tests**

Assert that `UserModule.create()` wires all five use cases to the same repository and that `Application.create()` exposes `userModule` while existing modules remain available.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- src/user/index.test.ts src/Application.test.ts`

Expected: FAIL because `UserModule` is not exported and `Application` has no user module.

- [ ] **Step 3: Implement the composition root**

Construct the repository once, inject it into all use cases, export domain types/errors and use cases from `src/user/index.ts`, add `public readonly userModule: UserModule` to `Application`, and create it in `Application.create()` without changing the initialization order or public behavior of document/navigation/publishing.

- [ ] **Step 4: Run the focused tests and verify success**

Run: `npm test -- src/user/index.test.ts src/Application.test.ts`

Expected: PASS.

### Task 6: Update project documentation and verify the complete change

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `src/content/nanobook-project/arquitectura/modulo-user.md` if implementation details differ from the design note.

- [ ] **Step 1: Add the Unreleased changelog entry**

Add an `Added` bullet describing the `user` bounded module, stable user IDs, profile use cases, and replaceable repository adapter.

- [ ] **Step 2: Run all tests**

Run: `npm run test`

Expected: PASS with all existing and new tests passing.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: PASS; no Astro route or environment configuration should be required by the profile-only module.

- [ ] **Step 4: Verify architectural boundaries**

Run: `rg -n "from ['\"](astro:|node:fs|node:path)|sessionStorage|fetch\(" src/user/domain src/user/application`

Expected: no matches.

- [ ] **Step 5: Review the final diff and working tree**

Run: `git diff --check; git status --short`

Expected: no whitespace errors; pre-existing changes remain accounted for and are not included in user-module commits.

## Deferred Follow-ups

- Add an HTTP/API adapter only after the desired route, authentication boundary, and error serialization contract are defined.
- Add password hashing, external identity providers, sessions, roles, permissions, and authorization policies as separate modules or bounded capabilities; do not place them in `User` by default.
- Replace `InMemoryUserRepository` with a database adapter only after the deployment database, migrations, uniqueness guarantees, and transaction semantics are selected.
- Add domain events such as `UserCreated` or `UserUpdated` only when another module has a concrete consumer; the profile-only slice does not need an event bus dependency.
