import { Document } from "../../domain/Document";
import type { DocumentParser } from "../../domain/ports/DocumentParser";
import { FrontmatterParser } from "../parse/FrontmatterParser";
import type { NanobookSettings } from "../../../../nanobooks/server";

export type BoundaryDecision = "independent" | "directory";

export interface MigrationDestination {
  nanobookId: string;
  sourceRoot: string;
  slug: string;
  ownerId: string;
  visibility: "public" | "private";
  settings?: NanobookSettings;
}

export interface MigrationBoundary {
  sourceIndex: string;
  decision: BoundaryDecision;
  destination: string;
}

export interface MigrationManifest {
  source: {
    type: "filesystem" | "github";
    root?: string;
    commit?: string;
  };
  destinations: MigrationDestination[];
  boundaries: MigrationBoundary[];
}

export interface MigrationDocument {
  id: string;
  path: string;
  nanobook?: boolean;
}

export interface MigratedDocument extends MigrationDocument {
  destination: string;
  targetPath: string;
}

/** Builds the canonical SQL document represented by a source assignment. */
export function buildMigratedDocument(
  sourceDocument: Document,
  assignment: MigratedDocument,
  parser: DocumentParser,
) {
  const sourceMetadata = sourceDocument.getMetadata();
  const rawMetadata = FrontmatterParser.parseFrontmatter(
    sourceDocument.getRawFrontmatter(),
  ).data as Record<string, unknown>;
  const createdAt = readSourceDate(
    rawMetadata.createdAt ?? rawMetadata.date,
    sourceMetadata.createdAt,
  );
  const updatedAt = readSourceDate(
    rawMetadata.updatedAt ?? rawMetadata.createdAt ?? rawMetadata.date,
    createdAt,
  );
  const metadata = {
    ...sourceMetadata,
    createdAt,
    updatedAt,
    nanobook: false,
    id: assignment.id,
  };
  const targetPath = sourceDocument.isIndex() && assignment.targetPath === "index"
    ? "index"
    : assignment.targetPath;

  return Document.create(
    targetPath,
    metadata,
    sourceDocument.getContent(),
    parser,
    sourceDocument.getRawFrontmatter().replace(/^nanobook:\s*true\s*\r?\n?/m, ""),
    assignment.id,
    1,
  );
}

function readSourceDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

export class ContentMigrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentMigrationValidationError";
  }
}

export function validateManifest(
  manifest: MigrationManifest,
  documents: MigrationDocument[] = [],
): void {
  if (!manifest.source?.type) {
    throw new ContentMigrationValidationError("source.type es obligatorio");
  }
  if (manifest.destinations.length === 0) {
    throw new ContentMigrationValidationError("Debe existir al menos un destino");
  }

  const destinationIds = new Set<string>();
  const roots = new Set<string>();
  for (const destination of manifest.destinations) {
    if (!destination.nanobookId || !destination.sourceRoot || !destination.slug || !destination.ownerId) {
      throw new ContentMigrationValidationError("Cada destino requiere nanobookId, sourceRoot, slug y ownerId");
    }
    if (destinationIds.has(destination.nanobookId)) {
      throw new ContentMigrationValidationError(`Destino duplicado: ${destination.nanobookId}`);
    }
    if (roots.has(destination.sourceRoot)) {
      throw new ContentMigrationValidationError(`Raíz de origen duplicada: ${destination.sourceRoot}`);
    }
    destinationIds.add(destination.nanobookId);
    roots.add(destination.sourceRoot);
  }

  const boundaries = new Set<string>();
  for (const boundary of manifest.boundaries) {
    if (boundaries.has(boundary.sourceIndex)) {
      throw new ContentMigrationValidationError(`Frontera duplicada: ${boundary.sourceIndex}`);
    }
    if (!destinationIds.has(boundary.destination)) {
      throw new ContentMigrationValidationError(`La frontera ${boundary.sourceIndex} apunta a un destino inexistente`);
    }
    if (boundary.decision === "independent") {
      const destination = manifest.destinations.find((item) => item.nanobookId === boundary.destination)!;
      if (destination.sourceRoot !== boundary.sourceIndex) {
        throw new ContentMigrationValidationError(
          `La frontera independiente ${boundary.sourceIndex} debe ser la raíz de ${boundary.destination}`,
        );
      }
    }
    boundaries.add(boundary.sourceIndex);
  }

  for (const document of documents) {
    if (!document.id || !document.path) {
      throw new ContentMigrationValidationError("Cada documento requiere id y path");
    }
    if (document.nanobook && !boundaries.has(document.path)) {
      throw new ContentMigrationValidationError(
        `El índice marcado ${document.path} necesita una decisión de frontera`,
      );
    }
  }
}

export function assignDocuments(
  manifest: MigrationManifest,
  documents: MigrationDocument[],
): MigratedDocument[] {
  validateManifest(manifest, documents);
  return documents.map((document) => {
    const destination = [...manifest.destinations]
      .map((candidate) => ({
        candidate,
        sourcePrefix: candidate.sourceRoot === "index"
          ? ""
          : candidate.sourceRoot.endsWith("/index")
            ? candidate.sourceRoot.slice(0, -"/index".length)
            : candidate.sourceRoot,
      }))
      .filter(({ candidate, sourcePrefix }) => candidate.sourceRoot === "index"
        || document.path === candidate.sourceRoot
        || document.path === sourcePrefix
        || document.path.startsWith(`${sourcePrefix}/`))
      .sort((left, right) => right.sourcePrefix.length - left.sourcePrefix.length)[0]?.candidate;
    if (!destination) {
      throw new ContentMigrationValidationError(`Documento huérfano: ${document.path}`);
    }

    const sourcePrefix = destination.sourceRoot === "index"
      ? ""
      : destination.sourceRoot.endsWith("/index")
        ? destination.sourceRoot.slice(0, -"/index".length)
        : destination.sourceRoot;
    const suffix = document.path === destination.sourceRoot || document.path === sourcePrefix
      ? "index"
      : sourcePrefix
        ? document.path.slice(sourcePrefix.length + 1)
        : document.path;
    return {
      ...document,
      destination: destination.nanobookId,
      targetPath: suffix,
    };
  });
}

export function buildMigrationReport(
  manifest: MigrationManifest,
  documents: MigrationDocument[],
) {
  const assignments = assignDocuments(manifest, documents);
  return {
    source: manifest.source,
    destinations: manifest.destinations.map((destination) => ({
      nanobookId: destination.nanobookId,
      slug: destination.slug,
      documents: assignments.filter((item) => item.destination === destination.nanobookId).length,
    })),
    assignments,
  };
}
