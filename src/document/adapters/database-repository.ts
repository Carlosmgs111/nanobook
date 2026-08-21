import type { ContentRepository, Document } from "../core/types";

/**
 * Stub de ContentRepository orientado a base de datos.
 *
 * No está implementado porque Nanobook sigue siendo filesystem-first en
 * esta etapa. Este archivo existe para:
 *
 * 1. Demostrar que ContentRepository es storage-agnostic.
 * 2. Servir de punto de partida cuando se añada PostgreSQL u otra DB.
 * 3. Documentar los métodos que un DatabaseRepository real necesitaría.
 *
 * Implementación futura:
 * - Conexión a PostgreSQL (u otra DB) mediante un cliente.
 * - Mapeo de filas SQL a Document.
 * - Consultas puntuales: getAncestors, getSiblings, getChildren.
 */
export class DatabaseRepository implements ContentRepository {
  async list(): Promise<Document[]> {
    throw new Error("DatabaseRepository not implemented yet");
  }

  async get(id: string): Promise<Document | null> {
    throw new Error(`DatabaseRepository.get(${id}) not implemented yet`);
  }

  async listChildren(parentId: string | null): Promise<Document[]> {
    throw new Error(
      `DatabaseRepository.listChildren(${parentId}) not implemented yet`,
    );
  }

  async save(document: Document): Promise<void> {
    throw new Error(`DatabaseRepository.save(${document.id}, ${document.content}) not implemented yet`);
  }

  // Métodos adicionales que un DatabaseRepository real necesitaría:
  // async getAncestors(id: string): Promise<Document[]> { ... }
  // async getSiblings(id: string): Promise<Document[]> { ... }
  // async create(document: Document): Promise<void> { ... }
  // async update(document: Document): Promise<void> { ... }
  // async delete(id: string): Promise<void> { ... }
}
