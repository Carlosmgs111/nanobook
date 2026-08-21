import { AstroCollectionRepository } from "../../document/adapters/astro-collection-repository";

export interface PreviewPageProps {
  slug: string;
  editHref: string;
}

export async function loadPreviewPageProps({
  documentId,
}: {
  documentId: string;
}): Promise<PreviewPageProps> {
  const repository = new AstroCollectionRepository();
  const entry = await repository.get(documentId);

  if (!entry) {
    throw new Error(`Document not found: ${documentId}`);
  }

  return {
    slug: entry.slug,
    editHref: `/${entry.slug}/edit`,
  };
}
