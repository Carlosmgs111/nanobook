import { describe, it, expect } from "vitest";
import {
  getParentId,
  idToFilePath,
  isIndexId,
  normalizeDocumentId,
  validateDocumentId,
} from "../path";

describe("path utilities", () => {
  describe("isIndexId", () => {
    it("detecta el índice raíz", () => {
      expect(isIndexId("index")).toBe(true);
    });

    it("detecta índices anidados", () => {
      expect(isIndexId("blog/index")).toBe(true);
      expect(isIndexId("blog/posts/index")).toBe(true);
    });

    it("rechaza documentos que no son índice", () => {
      expect(isIndexId("blog/post")).toBe(false);
      expect(isIndexId("indexado")).toBe(false);
    });
  });

  describe("validateDocumentId", () => {
    it("acepta ids válidos", () => {
      expect(() => validateDocumentId("index")).not.toThrow();
      expect(() => validateDocumentId("blog")).not.toThrow();
      expect(() => validateDocumentId("blog/post")).not.toThrow();
      expect(() => validateDocumentId("blog/posts/index")).not.toThrow();
    });

    it("rechaza ids vacíos", () => {
      expect(() => validateDocumentId("")).toThrow();
    });

    it("rechaza barras inicial o final", () => {
      expect(() => validateDocumentId("/blog/post")).toThrow();
      expect(() => validateDocumentId("blog/post/")).toThrow();
    });

    it("rechaza segmentos . o ..", () => {
      expect(() => validateDocumentId("../secret")).toThrow();
      expect(() => validateDocumentId("blog/./post")).toThrow();
    });
  });

  describe("normalizeDocumentId", () => {
    it("normaliza índices de directorio", () => {
      expect(normalizeDocumentId("index")).toBe("index");
      expect(normalizeDocumentId("blog/index")).toBe("blog");
      expect(normalizeDocumentId("blog/posts/index")).toBe("blog/posts");
    });

    it("deja documentos sin cambios", () => {
      expect(normalizeDocumentId("blog/post")).toBe("blog/post");
      expect(normalizeDocumentId("generador-demos")).toBe("generador-demos");
    });
  });

  describe("idToFilePath", () => {
    it("resuelve índices anidados", () => {
      const path = idToFilePath("blog", true, "./src/content");
      expect(path).toMatch(/src[\\/]content[\\/]blog[\\/]index\.md$/);
    });

    it("resuelve el índice raíz", () => {
      const path = idToFilePath("index", true, "./src/content");
      expect(path).toMatch(/src[\\/]content[\\/]index\.md$/);
    });

    it("resuelve documentos simples", () => {
      const path = idToFilePath("blog/post", false, "./src/content");
      expect(path).toMatch(/src[\\/]content[\\/]blog[\\/]post\.md$/);
    });
  });

  describe("getParentId", () => {
    it("devuelve null para el índice raíz", () => {
      expect(getParentId("index")).toBeNull();
    });

    it("devuelve index para documentos de primer nivel", () => {
      expect(getParentId("blog")).toBe("index");
    });

    it("devuelve el prefijo para documentos anidados", () => {
      expect(getParentId("blog/post")).toBe("blog");
      expect(getParentId("blog/posts/index")).toBe("blog");
    });
  });
});
