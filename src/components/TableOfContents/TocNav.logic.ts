import { findActiveIndex } from "../../lib/scroll-spy.ts";
import { collectHeadings, type HeadingRef } from "./TableOfContents.logic.ts";

export interface ActiveIndexRef {
  current: number;
}

export function updateActiveState(
  links: NodeListOf<HTMLElement>,
  lines: NodeListOf<HTMLElement>,
  headings: HeadingRef[],
  offsets: number[],
  offset: number,
  activeIndexRef: ActiveIndexRef
): void {
  const newIndex = findActiveIndex(window.scrollY, offsets, offset);
  if (newIndex === activeIndexRef.current) return;
  activeIndexRef.current = newIndex;

  const activeId = headings[newIndex].id;

  links.forEach((link) => {
    link.dataset.isActive = String(link.getAttribute("href") === "#" + activeId);
  });

  lines.forEach((line, i) => {
    line.dataset.isActive = String(i === newIndex);
  });
}

export function initScrollSpy(
  root: HTMLElement,
  links: NodeListOf<HTMLElement>,
  lines: NodeListOf<HTMLElement>,
  offset: number = 120
): void {
  if (links.length === 0) return;

  const headings = collectHeadings(links);
  if (headings.length === 0) return;

  let offsets: number[] = [];
  const activeIndex: ActiveIndexRef = { current: -1 };

  function measure() {
    offsets = headings.map((heading) => heading.element.offsetTop);
    updateActiveState(links, lines, headings, offsets, offset, activeIndex);
  }

  function onScroll() {
    updateActiveState(links, lines, headings, offsets, offset, activeIndex);
  }

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  });

  window.addEventListener("resize", measure);
  window.addEventListener("orientationchange", measure);

  if (document.readyState === "complete") {
    measure();
  } else {
    window.addEventListener("load", measure);
  }
}
