export type SidebarMode = "expanded" | "collapsed";

export function getSavedSidebarMode(): SidebarMode {
  if (typeof localStorage === "undefined") return "expanded";
  const saved = localStorage.getItem("sidebar-mode");
  return saved === "collapsed" ? "collapsed" : "expanded";
}

export function setSidebarMode(
  root: HTMLElement,
  button: HTMLElement,
  mode: SidebarMode
): void {
  root.setAttribute("data-sidebar-mode", mode);
  button.setAttribute("data-sidebar-mode", mode);
  button.setAttribute("aria-pressed", String(mode === "collapsed"));
  button.setAttribute(
    "aria-label",
    mode === "expanded" ? "Contraer navegación" : "Expandir navegación"
  );
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("sidebar-mode", mode);
  }
}

export function initSidebarMode(
  root: HTMLElement,
  button: HTMLElement
): void {
  setSidebarMode(root, button, getSavedSidebarMode());

  button.addEventListener("click", () => {
    const current =
      (root.getAttribute("data-sidebar-mode") as SidebarMode) || "expanded";
    const next = current === "expanded" ? "collapsed" : "expanded";
    setSidebarMode(root, button, next);
  });
}
