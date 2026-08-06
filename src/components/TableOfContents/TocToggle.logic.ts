export type TocMode = "standard" | "compact";

export function getSavedTocMode(): TocMode {
  if (typeof localStorage === "undefined") return "standard";
  const saved = localStorage.getItem("toc-mode");
  return saved === "compact" ? "compact" : "standard";
}

export function setTocMode(
  root: HTMLElement,
  button: HTMLElement,
  mode: TocMode
): void {
  root.setAttribute("data-toc-mode", mode);
  button.setAttribute("data-toc-mode", mode);
  button.setAttribute("aria-pressed", String(mode === "compact"));
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("toc-mode", mode);
  }
}

export function initTocMode(
  root: HTMLElement,
  button: HTMLElement
): void {
  setTocMode(root, button, getSavedTocMode());

  button.addEventListener("click", () => {
    const current =
      (root.getAttribute("data-toc-mode") as TocMode) || "standard";
    const next = current === "standard" ? "compact" : "standard";
    setTocMode(root, button, next);
  });
}
