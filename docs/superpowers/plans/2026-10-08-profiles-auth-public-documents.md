# Profile Module, Auth and Public Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build a new public profiles module linked to Better Auth identities and require a verified profile username for document mutations.

**Architecture:** Better Auth remains the source of identity and exposes a verified actor in Astro.locals. The new profiles module owns the public profile and persists user_profile.user_id as a one-to-one foreign key to Better Auth user.id. Application composes auth.protect(profile.requireUsername(route)) before document mutation controllers, while documents retain their owner-id authorization.

**Tech Stack:** Astro 7, TypeScript, Better Auth 1.7, Drizzle ORM with libSQL/SQLite, Vitest 4, Tailwind.

**Spec:** docs/superpowers/specs/2026-10-08-profiles-auth-public-documents-design.md

## Global Constraints

- ownerId remains the Better Auth user.id; username never authorizes access.
- Username is lowercase, unique, immutable, and matches ^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$.
- A document mutation needs session, verified email, profile username, and document ownership where applicable.
- Public profile responses never include email, session data, or userId.
- returnTo accepts only local absolute paths beginning with one slash, not two.
- Existing unscoped public document URLs and the legacy `users` module remain unchanged during this increment.
- Run npm run build before every commit and use Conventional Commits.

## Review Focus

- Case-insensitive collisions: Carlos-MGS111 and carlos-mgs111 must conflict (Tasks 1 and 3).
- Boundary validation: two characters, leading/trailing hyphens, invalid symbols, and 33 characters fail (Task 1).
- Actor spoofing: client-supplied userId or ownerId cannot affect writes (Tasks 4 and 6).
- A saved editor draft survives a 428 PROFILE_REQUIRED recovery (Task 7).
- /u/alice/path never renders a document owned by Bob (Task 8).

---

## File Structure

    src/server/profiles/
      domain/{Username,Profile,errors,types}.ts
      application/{CreateCurrentProfile,GetCurrentProfile,
        GetPublicProfileByUsername,UpdateCurrentProfile}.ts
      domain/ports/ProfileRepository.ts
      infraestructure/database/DrizzleProfileSchema.ts
      infraestructure/repository/DrizzleProfileRepository.ts
      infraestructure/rest/{controllers,requireUsername}.ts
      index.ts
    src/browser/profiles/
      client/{HttpProfileApi,ProfileController,returnTo}.ts
      ui/{ProfilePage,ProfileForm,PublicProfilePage}.astro
    src/pages/api/me/profile.ts
    src/pages/api/me/documents/[...slug].ts
    src/pages/api/profiles/[username].ts
    src/pages/api/profiles/[username]/documents.ts
    src/pages/u/[username]/index.astro
    src/pages/u/[username]/[...slug]/index.astro
    scripts/provision-profile.ts

The legacy `src/server/users` module and `src/pages/api/users` routes are outside this work and remain unchanged. The existing document mutation route also remains available during this increment.

### Task 1: Profile domain and username invariant

**Files:**
- Create: src/server/profiles/domain/Username.ts, Profile.ts, errors.ts, types.ts
- Test: src/server/profiles/domain/Username.test.ts, Profile.test.ts

**Interfaces:**
- Produces Username.create(input): Result<InvalidUsernameError, Username>.
- Produces Profile.create({ userId, username, displayName }): Result<ProfileError, Profile>.
- Produces Profile.toPublic(): { username: string; displayName: string } and updateDisplayName(input).

- [ ] **Step 1: Write failing tests**

    it("normalizes public usernames and rejects invalid boundaries", () => {
      expect(Username.create(" Carlos-MGS111 ").getValue().getValue()).toBe("carlos-mgs111");
      for (const value of ["ab", "-carlos", "carlos-", "carlos_mgs", "a".repeat(33)]) {
        expect(Username.create(value).isSuccess).toBe(false);
      }
    });

    it("keeps user id and username while updating display name", () => {
      const profile = Profile.create({ userId: "auth-user-1", username: "carlos", displayName: "Carlos" }).getValue();
      profile.updateDisplayName("Carlos Muñoz");
      expect(profile.toPublic()).toEqual({ username: "carlos", displayName: "Carlos Muñoz" });
      expect(profile.getUserId()).toBe("auth-user-1");
    });

- [ ] **Step 2: Verify RED**

Run: npm test -- src/profiles/domain/Username.test.ts src/profiles/domain/Profile.test.ts

Expected: FAIL because the profile domain does not exist.

- [ ] **Step 3: Implement minimal domain code**

    const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

    static create(input: string): Result<InvalidUsernameError, Username> {
      const value = input.trim().toLowerCase();
      return USERNAME_PATTERN.test(value)
        ? Result.ok(new Username(value))
        : Result.fail(new InvalidUsernameError(input));
    }

    updateDisplayName(input: string): Result<InvalidProfileError, void> {
      const value = input.trim();
      if (!value) return Result.fail(new InvalidProfileError("displayName es obligatorio"));
      this.displayName = value;
      this.updatedAt = new Date();
      return Result.ok();
    }

- [ ] **Step 4: Verify GREEN**

Run: npm test -- src/profiles/domain/Username.test.ts src/profiles/domain/Profile.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

    git add src/profiles/domain
    git commit -m "feat(profiles): add public profile domain"

### Task 2: Profile use cases and repository contract

**Files:**
- Create: src/server/profiles/domain/ports/ProfileRepository.ts
- Create: src/server/profiles/application/CreateCurrentProfile.ts, GetCurrentProfile.ts, GetPublicProfileByUsername.ts, UpdateCurrentProfile.ts, errors.ts
- Create: src/server/profiles/infraestructure/repository/InMemoryProfileRepository.ts
- Test: src/server/profiles/application/CreateCurrentProfile.test.ts, UpdateCurrentProfile.test.ts, GetPublicProfileByUsername.test.ts

**Interfaces:**
- Produces CreateCurrentProfile.execute(actorId, { username, displayName }).
- Produces GetCurrentProfile.execute(actorId), GetPublicProfileByUsername.execute(username), and UpdateCurrentProfile.execute(actorId, { displayName }).
- Repository has getByUserId, getByUsername, create, and update.

- [ ] **Step 1: Write failing tests**

    it("creates a profile only once for the session actor", async () => {
      expect((await create.execute("auth-user-1", { username: "Carlos", displayName: "Carlos" })).isSuccess).toBe(true);
      expect((await create.execute("auth-user-1", { username: "other", displayName: "Other" })).getError()).toBeInstanceOf(ProfileAlreadyExistsError);
    });

    it("rejects a normalized username held by another actor", async () => {
      await create.execute("auth-user-1", { username: "carlos", displayName: "Carlos" });
      expect((await create.execute("auth-user-2", { username: "CARLOS", displayName: "Other" })).getError()).toBeInstanceOf(UsernameAlreadyTakenError);
    });

- [ ] **Step 2: Verify RED**

Run: npm test -- src/profiles/application

Expected: FAIL because use cases and repository contract do not exist.

- [ ] **Step 3: Implement minimal capabilities**

    export interface ProfileRepository {
      getByUserId(userId: string): Promise<Result<ProfileRepositoryError, Profile | null>>;
      getByUsername(username: Username): Promise<Result<ProfileRepositoryError, Profile | null>>;
      create(profile: Profile): Promise<Result<ProfileRepositoryError | UsernameAlreadyTakenError, void>>;
      update(profile: Profile): Promise<Result<ProfileRepositoryError, void>>;
    }

    async execute(actorId: string, input: CreateProfileInput) {
      const existing = await this.repository.getByUserId(actorId);
      if (existing.getValue()) return Result.fail(new ProfileAlreadyExistsError(actorId));
      const profile = Profile.create({ userId: actorId, ...input });
      if (!profile.isSuccess) return Result.fail(profile.getError());
      const saved = await this.repository.create(profile.getValue());
      return saved.isSuccess ? Result.ok(profile.getValue()) : Result.fail(saved.getError());
    }

- [ ] **Step 4: Verify GREEN**

Run: npm test -- src/profiles/application

Expected: PASS.

- [ ] **Step 5: Commit**

    git add src/profiles
    git commit -m "feat(profiles): add profile application capabilities"

### Task 3: Profile schema, persistence, and provisioning

**Files:**
- Create: src/profiles/infraestructure/database/DrizzleProfileSchema.ts
- Create: src/profiles/infraestructure/repository/DrizzleProfileRepository.ts
- Test: src/profiles/infraestructure/repository/DrizzleProfileRepository.test.ts
- Modify: drizzle.config.ts, package.json
- Create: generated drizzle/0001_profiles.sql, scripts/provision-profile.ts, scripts/provision-profile.test.ts

**Interfaces:**
- Implements Task 2 repository against SQLite.
- Produces npm run profiles:provision -- --user-id ID --username NAME --display-name NAME.

- [ ] **Step 1: Write failing tests**

    it("maps a case-normalized database conflict to UsernameAlreadyTakenError", async () => {
      await repository.create(profile("auth-user-1", "carlos"));
      expect((await repository.create(profile("auth-user-2", "CARLOS"))).getError()).toBeInstanceOf(UsernameAlreadyTakenError);
    });

    it("provisions the same owner and username only once", async () => {
      await expect(provisionProfile(repository, seed)).resolves.toEqual({ created: true });
      await expect(provisionProfile(repository, seed)).resolves.toEqual({ created: false });
    });

- [ ] **Step 2: Verify RED**

Run: npm test -- src/profiles/infraestructure/repository/DrizzleProfileRepository.test.ts scripts/provision-profile.test.ts

Expected: FAIL because persistent repository and script helper do not exist.

- [ ] **Step 3: Implement schema, adapter, and command**

    export const userProfile = sqliteTable("user_profile", {
      userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
      username: text("username").notNull().unique(),
      displayName: text("display_name").notNull(),
      createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
      updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    });

Include both auth and profiles schemas in drizzle.config.ts, replacing the stale auth path ./src/auth/server/DrizzleAuthSchema.ts with ./src/auth/server/infrastructure/better-auth/DrizzleAuthSchema.ts. DrizzleProfileSchema may import only the exported auth user table to declare its foreign key. The provision helper returns { created: false } only when actor and username already match; otherwise it reports conflict and never rewrites identity.

- [ ] **Step 4: Verify GREEN**

Run: npm test -- src/profiles/infraestructure/repository/DrizzleProfileRepository.test.ts scripts/provision-profile.test.ts

Run: npx drizzle-kit generate

Expected: tests pass and generated SQL creates only user_profile plus its unique index and foreign key.

- [ ] **Step 5: Commit**

    git add drizzle drizzle.config.ts package.json scripts/provision-profile.ts src/profiles/infraestructure
    git commit -m "feat(profiles): persist public profiles"

### Task 4: Profile REST endpoints and composition

**Files:**
- Create: src/profiles/infraestructure/rest/utils.ts, CreateCurrentProfileController.ts, GetCurrentProfileController.ts, UpdateCurrentProfileController.ts, GetPublicProfileController.ts
- Create: src/profiles/infraestructure/rest/ProfileControllers.test.ts, src/profiles/index.ts
- Create: src/pages/api/me/profile.ts, src/pages/api/profiles/[username].ts
- Modify: src/Application.ts

**Interfaces:**
- Produces ProfileModule.create(routeProtector) and private/profile-public route handlers.
- Private handlers consume locals.currentUserId; public DTO is exactly { username, displayName }.

- [ ] **Step 1: Write failing controller tests**

    it("uses locals actor and ignores a forged userId payload", async () => {
      await controller.handle(context("POST", { username: "carlos", displayName: "Carlos", userId: "forged" }, { currentUserId: "auth-user-1" }));
      expect(create.execute).toHaveBeenCalledWith("auth-user-1", { username: "carlos", displayName: "Carlos" });
    });

    it("maps missing profile to 404 and a held username to 409", async () => {
      expect((await getMissingProfile()).status).toBe(404);
      expect((await createConflict()).status).toBe(409);
    });

- [ ] **Step 2: Verify RED**

Run: npm test -- src/profiles/infraestructure/rest/ProfileControllers.test.ts

Expected: FAIL because controllers and ProfileModule do not exist.

- [ ] **Step 3: Implement endpoints**

    export const GET = app.profileModule.getCurrentProfileController.handle;
    export const POST = app.profileModule.createCurrentProfileController.handle;
    export const PATCH = app.profileModule.updateCurrentProfileController.handle;

ProfileModule receives the auth RouteProtector and composes its private routes internally, following DocumentModule. Thus /api/me/profile exports module.privateProfileRoutes, while /api/profiles/[username] exports the raw public controller. Do not accept username in the PATCH DTO.

- [ ] **Step 4: Verify GREEN**

Run: npm test -- src/profiles/infraestructure/rest/ProfileControllers.test.ts src/Application.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

    git add src/profiles src/pages/api/me/profile.ts src/pages/api/profiles/[username].ts src/Application.ts
    git commit -m "feat(profiles): expose current and public profile endpoints"

### Task 5: Verified auth guard

**Files:**
- Modify: src/auth/model/AuthSession.ts
- Modify: src/auth/server/infrastructure/better-auth/BetterAuthSessionReader.ts
- Modify: src/auth/server/infrastructure/http/withAuthenticatedSession.ts
- Test: src/auth/server/infrastructure/better-auth/BetterAuthSessionReader.test.ts, src/auth/server/infrastructure/http/withAuthenticatedSession.test.ts

**Interfaces:**
- Adds AuthenticatedUser.emailVerified: boolean.
- AuthServerModule.protect returns 401 for no session and 403 with EMAIL_VERIFICATION_REQUIRED for an unverified session.

- [ ] **Step 1: Write failing guard test**

    it("does not invoke a protected handler for an unverified session", async () => {
      const response = await protectedHandler(contextFor({ id: "auth-user-1", emailVerified: false }));
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: "EMAIL_VERIFICATION_REQUIRED" });
      expect(handler).not.toHaveBeenCalled();
    });

- [ ] **Step 2: Verify RED**

Run: npm test -- src/auth/server/infrastructure/http/withAuthenticatedSession.test.ts src/auth/server/infrastructure/better-auth/BetterAuthSessionReader.test.ts

Expected: FAIL because the session contract lacks verification state.

- [ ] **Step 3: Implement verified mapping**

Map Better Auth user.emailVerified to the auth model. In withAuthenticatedSession check null first, then emailVerified false, and write actor locals only before invoking a verified handler.

- [ ] **Step 4: Verify GREEN**

Run: npm test -- src/auth/server/infrastructure/http/withAuthenticatedSession.test.ts src/auth/server/infrastructure/better-auth/BetterAuthSessionReader.test.ts src/auth/browser/HttpAuthSessionReader.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

    git add src/auth
    git commit -m "feat(auth): require verified email for protected routes"

### Task 6: Username decorator and /api/me/documents

**Files:**
- Create: src/profiles/infraestructure/rest/requireUsername.ts, requireUsername.test.ts
- Modify: src/profiles/index.ts, src/documents/index.ts, src/Application.ts
- Create: src/pages/api/me/documents/[...slug].ts
- Delete: src/pages/api/documents/[...slug].ts
- Modify: src/edition/infrastructure/documentWriter/HttpDocumentWriter.ts, HttpDocumentWriter.test.ts
- Modify: src/documents/infraestructure/rest/protectDocumentMutationRoutes.test.ts

**Interfaces:**
- Produces ProfileModule.requireUsername(handler): APIRoute.
- Application passes document a guard equivalent to auth.protect(profile.requireUsername(handler)).

- [ ] **Step 1: Write failing guard and writer tests**

    it("returns stable 428 profile-required response before the document handler", async () => {
      const response = await requireUsername(noProfileRepository, handler)(contextWithActor("auth-user-1"));
      expect(response.status).toBe(428);
      await expect(response.json()).resolves.toEqual({
        code: "PROFILE_REQUIRED",
        message: "Debes elegir un nombre de usuario antes de crear o modificar documentos.",
        setupUrl: "/profile",
      });
      expect(handler).not.toHaveBeenCalled();
    });

    it("targets the current actor document endpoint", async () => {
      await new HttpDocumentWriter().deleteDocument("doc-delete");
      expect(fetch).toHaveBeenCalledWith("/api/me/documents/doc-delete", expect.objectContaining({ method: "DELETE" }));
    });

- [ ] **Step 2: Verify RED**

Run: npm test -- src/profiles/infraestructure/rest/requireUsername.test.ts src/documents/infraestructure/rest/protectDocumentMutationRoutes.test.ts src/edition/infraestructure/documentWriter/HttpDocumentWriter.test.ts

Expected: FAIL because username guard and current-user URL do not exist.

- [ ] **Step 3: Implement ordered guards and private endpoint**

The username decorator checks only locals.currentUserId and profile existence. A missing profile returns exactly the tested 428; a repository failure maps to 500. In Application, create a RouteProtector object whose protect method returns authServerModule.protect(profileModule.requireUsername(route)); pass that object to DocumentModule. Expose POST/PATCH/DELETE from /api/me/documents/[...slug].ts, and use /api/me/documents plus encoded id in HttpDocumentWriter.

- [ ] **Step 4: Verify GREEN**

Run: npm test -- src/profiles/infraestructure/rest/requireUsername.test.ts src/documents/infraestructure/rest/protectDocumentMutationRoutes.test.ts src/edition/infraestructure/documentWriter/HttpDocumentWriter.test.ts src/documents/infraestructure/rest/CreateDocumentController.test.ts

Expected: PASS; owner mismatches still return the existing document 403.

- [ ] **Step 5: Commit**

    git add src/profiles src/documents src/edition src/pages/api/me src/Application.ts
    git rm src/pages/api/documents/[...slug].ts
    git commit -m "feat(documents): require verified profile for mutations"

### Task 7: Profile UI and 428 recovery

**Files:**
- Create: src/profiles/client/HttpProfileApi.ts, ProfileController.ts, returnTo.ts
- Test: src/profiles/client/returnTo.test.ts, ProfileController.test.ts
- Create: src/profiles/ui/ProfilePage.astro, ProfileForm.astro
- Modify: src/pages/profile.astro
- Modify: src/edition/domain/errors.ts, src/edition/infrastructure/documentWriter/HttpDocumentWriter.ts
- Modify: src/edition/ui/pages/NewPage.astro, src/edition/ui/components/EditorToolbar.astro

**Interfaces:**
- Produces safeReturnTo(value): string | null.
- Adds EditionWriterError.code?: PROFILE_REQUIRED.

- [ ] **Step 1: Write failing client tests**

    it("allows local return targets and rejects open redirects", () => {
      expect(safeReturnTo("/guide/new")).toBe("/guide/new");
      for (const value of ["https://evil.test", "//evil.test", "javascript:alert(1)", "guide/new"]) {
        expect(safeReturnTo(value)).toBeNull();
      }
    });

    it("retains a draft and routes to setup after profile-required response", async () => {
      writer.updateDocument.mockResolvedValue(Result.fail(new EditionWriterError("profile", { code: "PROFILE_REQUIRED" })));
      await save.execute("doc-1");
      expect(storage.loadStagedDocument("doc-1").isSuccess).toBe(true);
      expect(navigate).toHaveBeenCalledWith("/profile?returnTo=%2Fguide%2Fedit");
    });

- [ ] **Step 2: Verify RED**

Run: npm test -- src/profiles/client/returnTo.test.ts src/profiles/client/ProfileController.test.ts src/edition/infraestructure/documentWriter/HttpDocumentWriter.test.ts

Expected: FAIL because profile client and typed recovery do not exist.

- [ ] **Step 3: Implement UI and recovery**

Use HttpProfileApi as the sole client adapter for GET, POST, and PATCH /api/me/profile. /profile renders creation after 404, otherwise display-name editing with readonly username. New-document UI redirects to profile setup before submit when profile is absent. Keep staged editor entries when writer exposes PROFILE_REQUIRED and redirect using validated returnTo.

- [ ] **Step 4: Verify GREEN**

Run: npm test -- src/profiles/client/returnTo.test.ts src/profiles/client/ProfileController.test.ts src/edition/infraestructure/documentWriter/HttpDocumentWriter.test.ts src/edition/application/test/SaveDocument.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

    git add src/profiles src/pages/profile.astro src/edition
    git commit -m "feat(profiles): add profile setup and mutation recovery"

### Task 8: Public profile document queries and pages

**Files:**
- Create: src/profiles/application/GetPublicDocumentsByUsername.ts, test
- Create: src/profiles/application/ports/PublicDocumentsReader.ts
- Create: src/profiles/infraestructure/rest/GetPublicProfileDocumentsController.ts, test
- Create: src/documents/infraestructure/profiles/DocumentModulePublicDocumentsReader.ts, test
- Create: src/pages/api/profiles/[username]/documents.ts
- Create: src/profiles/ui/PublicProfilePage.astro
- Create: src/pages/u/[username]/index.astro, src/pages/u/[username]/[...slug]/index.astro
- Modify: src/documents/index.ts, src/Application.ts, CHANGELOG.md
- Create: src/content/nanobook-project/arquitectura/perfiles-publicos-auth.md
- Test: src/Application.test.ts

**Interfaces:**
- PublicDocumentsReader defines listByOwnerId(ownerId) and getByPublicPathForOwner(ownerId, path).
- DocumentModulePublicDocumentsReader implements that consumer-owned port using DocumentModule reads; after both modules are constructed, Application composes GetPublicDocumentsByUsername and its REST controller.
- Application exposes profileModule; the unused legacy users module remains uncomposed and unchanged.

- [ ] **Step 1: Write failing query and composition tests**

    it("returns only documents owned by the resolved profile", async () => {
      expect((await query.execute("alice")).getValue().map((document) => document.documentId)).toEqual(["alice-guide"]);
    });

    it("does not render a known path when profile ownership differs", async () => {
      expect((await renderPublicDocument("alice", "bob-private")).status).toBe(404);
    });

    it("composes profiles without depending on the legacy user module", async () => {
      const app = await Application.create();
      expect(app.profileModule).toBeDefined();
    });

- [ ] **Step 2: Verify RED**

Run: npm test -- src/profiles/application/GetPublicDocumentsByUsername.test.ts src/profiles/infraestructure/rest/GetPublicProfileDocumentsController.test.ts src/Application.test.ts

Expected: FAIL because owner-scoped reads, canonical pages, and profile-only composition do not exist.

- [ ] **Step 3: Implement owner-scoped public reading and removal**

DocumentModulePublicDocumentsReader receives ownerId, never username, for list and detail reads. Profiles resolves username first, then calls its PublicDocumentsReader port. /u/[username]/index.astro renders profile plus owned list. /u/[username]/[...slug]/index.astro returns Astro 404 unless document metadata owner equals profile user id. Do not alter, delete, provision, or import the independent users code or routes. Add the completed behavior to CHANGELOG Unreleased.

- [ ] **Step 4: Verify GREEN**

Run: npm test -- src/profiles src/documents/application/GetDocument.test.ts src/Application.test.ts

Run: rg -n "from .*users" src/server/Application.ts

Expected: tests pass; Application has no legacy users import.

- [ ] **Step 5: Full verification and commit**

    npm test
    npm run build
    git -c core.whitespace=cr-at-eol diff --check
    git add src/server/profiles src/pages/u src/pages/api/profiles src/server/documents src/server/Application.ts CHANGELOG.md src/content/nanobook-project/arquitectura
    git commit -m "feat(profiles): add public profile document views"

Expected: build succeeds. If the full suite retains an unrelated failure, record its exact file and error; never report it as green.
