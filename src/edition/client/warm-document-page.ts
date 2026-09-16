type PageFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function warmDocumentPage(
  href: string,
  fetchPage: PageFetch = fetch
): Promise<void> {
  try {
    await fetchPage(href, { credentials: "same-origin" });
  } catch {
    // Precalentar es una optimización; nunca debe afectar el guardado.
  }
}
