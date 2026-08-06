export function openSidebar(
  root: HTMLElement,
  backdrop: HTMLElement
): void {
  root.classList.remove("hidden", "-translate-x-full");
  root.classList.add("translate-x-0");
  backdrop.classList.remove("hidden");
  backdrop.setAttribute("aria-hidden", "false");
}

export function closeSidebar(
  root: HTMLElement,
  backdrop: HTMLElement
): void {
  root.classList.add("hidden", "-translate-x-full");
  root.classList.remove("translate-x-0");
  backdrop.classList.add("hidden");
  backdrop.setAttribute("aria-hidden", "true");
}

export function initSidebarMobile(
  root: HTMLElement,
  openButton: HTMLElement | null,
  closeButton: HTMLElement | null,
  backdrop: HTMLElement
): void {
  if (!openButton || !closeButton) return;

  openButton.addEventListener("click", () => openSidebar(root, backdrop));
  closeButton.addEventListener("click", () => closeSidebar(root, backdrop));
  backdrop.addEventListener("click", () => closeSidebar(root, backdrop));

  root.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeSidebar(root, backdrop));
  });
}
