---
name: nanobook-testing
description: Use when writing, updating, or refactoring unit tests for the nanobook project. Covers Vitest conventions, mock factories, Result/EventBus mocking, application-layer design, and DDD testing best practices.
---

# Nanobook Testing

This skill defines how to write maintainable unit tests for nanobook's domain-driven, hexagonal architecture.

## Test framework and configuration

- Tests run with **Vitest** (`npm test`, `npm run test:watch`).
- `globals: false` in `vitest.config.ts`, so always import `describe`, `it`, `expect`, `vi` from `vitest`.
- Environment is `node`; `.astro` files are excluded. Do not try to test Astro UI components with this setup.

## What to test

- **Application services** (use cases in `src/<module>/application/`) are the primary test target.
- **Domain logic** can be tested directly when it contains conditional behavior (e.g., `DocumentId`, `DocumentReference`).
- **Adapters** (`infraestructure/`) should only be tested if they contain non-trivial logic; otherwise rely on integration/build checks.
- Do **not** test UI components, Astro pages, or build-time rendering with Vitest.

## What to mock

- **Ports** are mocked, never concrete adapters.
  - `ContentRepository` from `src/document/domain/ports/ContentRepository`.
  - `EventBus` from `src/shared/domain/bus/EventBus`.
  - `DocumentParser` from `src/document/domain/ports/DocumentParser` when needed.
- Use `vi.fn()` and `mockResolvedValue`/`mockReturnValue` for collaborators.
- Keep mocks simple: they should return `Result.ok(...)` or `Result.fail(...)`.

## Factories and helpers

- Place reusable test builders next to the tests they support, e.g. `src/document/application/test/factories.ts`.
- Provide helpers such as:
  - `createInMemoryRepository(documents?)`
  - `createEventBus()`
  - `buildDocumentInput(overrides?)`
  - `createDocument(id, metadata, content?)`
- Factories should return fully valid defaults and accept `Partial<...>` overrides.
- Avoid sharing mutable state between tests; build fresh instances in `arrange` or in a `beforeEach`.

## Testing use cases

Follow **Arrange-Act-Assert**:

1. **Arrange**: build the use case with mocked collaborators and prepare input.
2. **Act**: call `await useCase.execute(input)`.
3. **Assert**:
   - Check `result.isSuccess`.
   - On success, assert the returned value or side effects (repository method called, event published).
   - On failure, assert the error type with `toBeInstanceOf`.

## Result pattern assertions

```ts
expect(result.isSuccess).toBe(true);
expect(result.getValue().getId().getValue()).toBe("intro");

expect(result.isSuccess).toBe(false);
expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
```

## EventBus assertions

- Assert the event type/name and payload, not just call count:

```ts
expect(eventBus.publish).toHaveBeenCalledWith(
  expect.objectContaining({ name: "Document:Created", payload: { id: "intro" } })
);
```

## Error and rollback assertions

When a use case fails after side effects, the test must verify that later steps did **not** run:

```ts
expect(repository.create).not.toHaveBeenCalled();
expect(eventBus.publish).not.toHaveBeenCalled();
```

## Avoid these anti-patterns

- Do not import `DocumentChangeNotifier`, `DocumentNotificationError`, or any removed/deprecated types.
- Do not use the old `ContentRepository` interface from `src/document/domain/types`; import it from `src/document/domain/ports/ContentRepository`.
- Do not assert on private methods or internal state.
- Do not create broad mocks that return success for every possible call; configure only the methods the use case invokes.
- Do not skip tests unless you add a clear `// TODO:` explaining why.

## Test file naming and structure

- Co-locate tests with the code under test: `CreateDocument.test.ts` next to `CreateDocument.ts`.
- Use `describe("CreateDocument", () => { ... })` wrapping individual `it("...", async () => { ... })` cases.
- Test names should describe behavior, not implementation: `it("publishes DocumentCreated after a successful creation")` rather than `it("calls eventBus.publish")`.

## When tests need a real repository

- Prefer an in-memory implementation over mocking when the test is about repository interactions.
- `InMemoryRepository` is acceptable for use-case tests if it lives in the same module and is easy to instantiate.
- Reset in-memory state before each test.

## Async tests

- All use-case tests are async; always `await` the execution and use `async` test callbacks.

## Type safety

- Avoid `as unknown as string` casts to force invalid input. Instead, build an invalid `DocumentInput` naturally (e.g., omitting required fields with `// @ts-expect-error` or using a factory that accepts `Partial<DocumentInput>`).
- Use `// @ts-expect-error` when intentionally testing invalid runtime input.

## Running tests before committing

- Run `npm test` after updating tests.
- Do not commit if any test fails, unless the failure documents a known bug tracked elsewhere.
