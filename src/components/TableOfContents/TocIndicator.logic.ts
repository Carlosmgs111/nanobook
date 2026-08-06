import { collectHeadings } from "./TableOfContents.logic.ts";

export function positionIndicatorLines(
  lines: NodeListOf<HTMLElement>,
  offsets: number[]
): void {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  lines.forEach((line, i) => {
    const percent =
      total > 0 ? (offsets[i] / total) * 100 : i === 0 ? 0 : 100;
    line.style.top = `${Math.min(100, Math.max(0, percent))}%`;
  });
}

export function initIndicatorLines(
  links: NodeListOf<HTMLElement>,
  lines: NodeListOf<HTMLElement>
): void {
  if (links.length === 0 || lines.length === 0) return;

  const headings = collectHeadings(links);
  if (headings.length === 0) return;

  function measure() {
    const offsets = headings.map((heading) => heading.element.offsetTop);
    positionIndicatorLines(lines, offsets);
  }

  window.addEventListener("resize", measure);
  window.addEventListener("orientationchange", measure);

  if (document.readyState === "complete") {
    measure();
  } else {
    window.addEventListener("load", measure);
  }
}
