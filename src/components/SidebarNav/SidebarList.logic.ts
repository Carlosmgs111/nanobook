export function showTooltip(
  root: HTMLElement,
  target: Element,
  tooltip: HTMLElement
): void {
  if (root.getAttribute("data-sidebar-mode") !== "collapsed") {
    hideTooltip(tooltip);
    return;
  }

  const title = target.getAttribute("data-tooltip");
  if (!title) return;

  const rect = target.getBoundingClientRect();
  const gap = 12;
  let left = rect.right + gap;
  let top = rect.top + rect.height / 2;

  tooltip.textContent = title;
  tooltip.classList.remove("hidden");

  const tipRect = tooltip.getBoundingClientRect();
  top = top - tipRect.height / 2;

  const maxLeft = window.innerWidth - tipRect.width - gap;
  if (left > maxLeft) {
    left = rect.left - gap - tipRect.width;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

export function hideTooltip(tooltip: HTMLElement): void {
  tooltip.classList.add("hidden");
}

export function initSidebarTooltips(
  root: HTMLElement,
  tooltip: HTMLElement
): void {
  if (window.innerWidth < 768) return;

  const targets = root.querySelectorAll(".sidebar-link, .sidebar-parent");
  targets.forEach((target) => {
    target.addEventListener("mouseenter", () =>
      showTooltip(root, target, tooltip)
    );
    target.addEventListener("mouseleave", () => hideTooltip(tooltip));
    target.addEventListener("focus", () => showTooltip(root, target, tooltip));
    target.addEventListener("blur", () => hideTooltip(tooltip));
  });

  window.addEventListener("resize", () => hideTooltip(tooltip));
  window.addEventListener("scroll", () => hideTooltip(tooltip), true);
}
