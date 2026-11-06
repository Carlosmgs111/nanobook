import { describe, expect, it } from "vitest";
import { indexBodyWarning } from "./indexDocumentAdvice";

describe("indexBodyWarning", () => {
  it("warns when an index document carries a body that its page never shows", () => {
    const warning = indexBodyWarning("index", "# Título\n\nTexto que nadie verá.");

    expect(warning).toContain("«index»");
    expect(warning).toContain("create_document");
    expect(warning).toContain("no se muestra");
  });

  it("treats a section index like the root index", () => {
    expect(indexBodyWarning("finanzas/index", "# Finanzas\n\nIntroducción")).toContain("«finanzas/index»");
  });

  it("counts anything beyond the first-level title as body, including links and subheadings", () => {
    expect(indexBodyWarning("index", "# T\n\n- [Resumen](./resumen)")).toBeDefined();
    expect(indexBodyWarning("index", "# T\n\n## Sección")).toBeDefined();
  });

  it("stays quiet for the content the system creates itself", () => {
    expect(indexBodyWarning("index", "# Mi nanobook\n")).toBeUndefined();
    expect(indexBodyWarning("index", "")).toBeUndefined();
    expect(indexBodyWarning("index", "\n\n# Solo título\n\n")).toBeUndefined();
  });

  it("stays quiet for ordinary documents, even ones whose name merely contains index", () => {
    expect(indexBodyWarning("resumen", "# R\n\nTexto")).toBeUndefined();
    expect(indexBodyWarning("indexacion", "# R\n\nTexto")).toBeUndefined();
    expect(indexBodyWarning("notas/reindex", "# R\n\nTexto")).toBeUndefined();
  });

  it("does not warn about a path it cannot interpret", () => {
    expect(indexBodyWarning("", "texto")).toBeUndefined();
    expect(indexBodyWarning("ruta no válida/index", "texto")).toBeUndefined();
  });
});
