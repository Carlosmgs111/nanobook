export interface HeadingRef {
  id: string;
  element: HTMLElement;
}

export function collectHeadings(
  links: NodeListOf<HTMLElement>
): HeadingRef[] {
  const headings: HeadingRef[] = [];
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    const heading = document.getElementById(href.slice(1));
    if (heading) {
      headings.push({ id: heading.id, element: heading });
    }
  });
  return headings;
}
