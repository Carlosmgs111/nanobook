export function isInsideDocumentFlow(
  url: URL,
  documentId: string
): boolean {
  const path = url.pathname.replace(/\/$/, "");

  if (documentId === "index") {
    return path === "" || path === "/edit" || path === "/preview";
  }

  return (
    path === `/${documentId}` ||
    path === `/${documentId}/edit` ||
    path === `/${documentId}/preview`
  );
}
