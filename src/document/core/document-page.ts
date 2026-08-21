import { AstroCollectionRepository } from "../adapters/astro-collection-repository";
import { UnifiedMarkdownRenderer } from "../../rendering/adapters/unified-markdown";
import {
  buildNavigationTree,
  getBreadcrumbs,
  getFolderPath,
  getImmediateChildren,
  getParentEntry,
  getSidebarEntries,
} from "../../navigation/core/builder";
import { parseDocument } from "./document";
import type { Document } from "./types";

export interface DocumentPageProps {
  entry: Document;
  Content: string;
  headings: ReturnType<typeof parseDocument>["headings"];
  childEntries: { id: string; data: Document["metadata"] }[];
  breadcrumbs: ReturnType<typeof getBreadcrumbs>;
  sidebarEntries: ReturnType<typeof getSidebarEntries>;
  parentEntry: { id: string; data: { title: string } } | null;
  editHref?: string;
}

export async function getStaticPaths() {
  const repository = new AstroCollectionRepository();
  const documents = await repository.list();

  return documents.map((document) => ({
    params: { slug: document.slug || undefined },
    props: { documentId: document.id },
  }));
}

export async function loadDocumentPageProps({
  documentId,
}: {
  documentId: string;
}): Promise<DocumentPageProps> {
  const repository = new AstroCollectionRepository();
  const entry = await repository.get(documentId);

  if (!entry) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const allDocuments = await repository.list();
  const { nodeMap } = buildNavigationTree(allDocuments);
  const breadcrumbs = getBreadcrumbs(nodeMap, entry.id);
  const sidebarEntries = getSidebarEntries(nodeMap, entry.id);
  const parentNode = getParentEntry(nodeMap, entry.id);
  const parentEntry = parentNode
    ? { id: parentNode.id, data: { title: parentNode.title } }
    : null;

  const { Content } = await new UnifiedMarkdownRenderer().render(entry);

  return {
    entry,
    Content,
    headings: parseDocument({ body: entry.content }).headings,
    childEntries: entry.metadata.index
      ? getImmediateChildren(nodeMap, getFolderPath(entry.id), entry.id).map(
          (child) => ({ id: child.id, data: child.metadata })
        )
      : [],
    breadcrumbs,
    sidebarEntries,
    parentEntry,
    editHref: entry.metadata.index ? undefined : `/${entry.slug}/edit`,
  };
}
