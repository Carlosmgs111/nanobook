import { performance } from "node:perf_hooks";

import { DrizzleContentRepository } from "../src/documents/server/infraestructure/repository/DrizzleContentRepository";
import type { Document } from "../src/documents/server/domain/Document";
import { createDocumentFromRaw } from "../src/documents/server/infraestructure/repository/createDocumentFromRaw";
import { UnifiedDocumentParser } from "../src/documents/server/infraestructure/parse/DocumentParser";
import { fetchGitHubBlob, fetchGitHubTree } from "../src/shared/github/api";
import { filterContentFiles } from "../src/shared/github/parser";
import { toDocumentId } from "../src/shared/utils/documentPath";
import { db, client } from "../src/shared/infrastructure/database/drizzleDatabase";

type BenchmarkSource = "sql" | "github";

const source = (valueAfter("--source") ?? "sql") as BenchmarkSource;
const iterations = positiveInteger("--iterations", 100);
const concurrency = positiveInteger("--concurrency", 1);
const nanobookId = valueAfter("--nanobook-id");

if (source !== "sql" && source !== "github") {
  throw new Error("--source debe ser sql o github");
}
if (source === "sql" && !nanobookId) {
  throw new Error("Uso SQL: npm run content:benchmark -- --nanobook-id <id> [--iterations 100] [--concurrency 1]");
}

async function main(): Promise<void> {
  const repository = await createRepository();
  try {
    const documents = await repository.list();
    if (documents.length === 0) {
      throw new Error("El repositorio no contiene documentos para medir");
    }

    const documentId = valueAfter("--document-id") ?? documents[0].getDocumentId().getValue();
    const parentPath = valueAfter("--parent-path") ?? documents[0].getParentPath()?.getPublicValue() ?? null;
    const measurements = {
      getById: await measure(iterations, concurrency, async () => {
        await repository.getById(documentId);
      }),
      listChildren: await measure(iterations, concurrency, async () => {
        await repository.listChildren(parentPath);
      }),
    };

    console.log(JSON.stringify({
      source,
      iterations,
      concurrency,
      documentId,
      parentPath,
      catalogSize: documents.length,
      measurements,
    }, null, 2));
  } finally {
    if (source === "sql") client.close();
  }
}

async function measure(
  count: number,
  workers: number,
  operation: () => Promise<void>,
): Promise<{ count: number; errors: number; p50Ms: number; p95Ms: number; p99Ms: number; meanMs: number }> {
  const samples: number[] = [];
  let errors = 0;
  let next = 0;

  await Promise.all(Array.from({ length: Math.min(count, workers) }, async () => {
    while (next < count) {
      const current = next++;
      const started = performance.now();
      try {
        await operation();
      } catch {
        errors += 1;
      } finally {
        samples[current] = performance.now() - started;
      }
    }
  }));

  const sorted = samples.filter(Number.isFinite).sort((left, right) => left - right);
  return {
    count: sorted.length,
    errors,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    meanMs: sorted.length === 0 ? 0 : sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
}

function positiveInteger(flag: string, fallback: number): number {
  const value = Number(valueAfter(flag) ?? fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${flag} debe ser un entero positivo`);
  return value;
}

function valueAfter(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

async function createRepository() {
  if (source === "sql") {
    return new SqlReadRepository(new DrizzleContentRepository(db, nanobookId!, new UnifiedDocumentParser()));
  }

  return new GitHubReadRepository({
    owner: requiredEnvironment("GITHUB_OWNER"),
    repo: requiredEnvironment("GITHUB_REPO"),
    branch: process.env.GITHUB_BRANCH ?? "main",
    token: process.env.GITHUB_TOKEN,
    path: process.env.GITHUB_PATH,
    pattern: ["**/*.md", "!README.md"],
  }, new UnifiedDocumentParser());
}

interface ReadRepository {
  list(): Promise<Document[]>;
  getById(id: string): Promise<Document | null>;
  listChildren(parentPath: string | null): Promise<Document[]>;
}

class SqlReadRepository implements ReadRepository {
  constructor(private readonly repository: DrizzleContentRepository) {}

  async list(): Promise<Document[]> {
    return unwrap(await this.repository.list());
  }

  async getById(id: string): Promise<Document | null> {
    return unwrap(await this.repository.getById(id));
  }

  async listChildren(parentPath: string | null): Promise<Document[]> {
    return unwrap(await this.repository.listChildren(parentPath));
  }
}

class GitHubReadRepository implements ReadRepository {
  private documentsPromise: Promise<Document[]> | undefined;

  constructor(
    private readonly options: {
      owner: string;
      repo: string;
      branch: string;
      token?: string;
      path?: string;
      pattern: string[];
    },
    private readonly parser: UnifiedDocumentParser,
  ) {}

  async list(): Promise<Document[]> {
    this.documentsPromise ??= this.load();
    return this.documentsPromise;
  }

  async getById(id: string): Promise<Document | null> {
    return (await this.list()).find((document) => document.getDocumentId().getValue() === id) ?? null;
  }

  async listChildren(parentPath: string | null): Promise<Document[]> {
    return (await this.list()).filter(
      (document) => document.getParentPath()?.getPublicValue() === parentPath,
    );
  }

  private async load(): Promise<Document[]> {
    const tree = await fetchGitHubTree(this.options);
    const files = filterContentFiles(tree, this.options.path ?? "", this.options.pattern);
    const documents: Document[] = [];

    for (const file of files) {
      const raw = await fetchGitHubBlob({
        owner: this.options.owner,
        repo: this.options.repo,
        branch: this.options.branch,
        token: this.options.token,
        sha: file.sha,
      });
      const result = createDocumentFromRaw(
        toDocumentId(file.path, { basePath: this.options.path, lowercase: true }),
        raw,
        this.parser,
      );
      if (!result.isSuccess) throw result.getError();
      documents.push(result.getValue());
    }

    return documents;
  }
}

function unwrap<T>(result: { isSuccess: boolean; getValue(): T; getError(): Error }): T {
  if (!result.isSuccess) throw result.getError();
  return result.getValue();
}

await main();
