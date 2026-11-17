import type { Result } from "../../../../shared/domain/Result";
import type { Nanobook } from "../Nanobook";

export interface NanobookRootDocument {
  /** Garantiza que el nanobook tiene su documento raíz `index`; idempotente. */
  ensure(nanobook: Nanobook): Promise<Result<Error, void>>;
}
