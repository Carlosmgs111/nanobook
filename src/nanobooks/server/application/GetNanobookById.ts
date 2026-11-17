import { Result } from "../../../shared/domain/Result";
import type { Nanobook } from "../domain/Nanobook";
import type { NanobookRepository, NanobookRepositoryFailure } from "../domain/ports/NanobookRepository";
import { NanobookNotFoundError } from "../domain/errors";

/**
 * Carga un nanobook por id sin comprobar acceso: quien llama debe haber autorizado antes.
 * Va directo al repositorio (no a la caché de lectura) porque esa caché está indexada por slug
 * y esta consulta, usada solo por la herramienta MCP `get_nanobook`, es por id.
 */
export class GetNanobookById {
  constructor(private readonly repository: NanobookRepository) {}

  async execute(id: string): Promise<Result<NanobookRepositoryFailure | NanobookNotFoundError, Nanobook>> {
    const found = await this.repository.findById(id);
    if (!found.isSuccess) return Result.fail(found.getError());
    const nanobook = found.getValue();
    return nanobook ? Result.ok(nanobook) : Result.fail(new NanobookNotFoundError(id));
  }
}
