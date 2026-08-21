import { AstroCollectionRepository } from "../../document/adapters/astro-collection-repository";
import {
  buildNavigationTree,
  getBreadcrumbs,
  getParentEntry,
  getSidebarEntries,
} from "../../navigation/core/builder";
import type { Document } from "../../document/core/types";

export interface EditPageProps {
  entry: Document;
  breadcrumbs: ReturnType<typeof getBreadcrumbs>;
  sidebarEntries: ReturnType<typeof getSidebarEntries>;
  parentEntry: { id: string; data: { title: string } } | null;
  previewHref?: string;
  viewHref: string;
}

export async function getStaticPaths() {
  const repository = new AstroCollectionRepository();
  const documents = await repository.list();

  return documents
    .filter((document) => !document.metadata.index)
    .map((document) => ({
      params: { slug: document.slug || undefined },
      props: { documentId: document.id },
    }));
}

export async function loadEditPageProps({
  documentId,
}: {
  documentId: string;
}): Promise<EditPageProps> {
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

  return {
    entry,
    breadcrumbs,
    sidebarEntries,
    parentEntry,
    previewHref: `/${entry.slug}/preview`,
    viewHref: `/${entry.slug}`,
  };
}
