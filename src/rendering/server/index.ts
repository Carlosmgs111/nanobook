import {
  createBlockRegistry,
  createComponentBlocksExtension,
  createMarkdownEngine,
  type BlockRegistry,
  type MarkdownEngine,
} from "../shared";
import { DocumentPieceResolver } from "./DocumentPieceResolver";

export type { DocumentPiece } from "./DocumentPieceResolver";

export class RenderingModule {
  private constructor(
    /** Registro vacío: cada módulo registra aquí sus bloques cuando se compone. */
    public readonly blocks: BlockRegistry,
    /** El mismo motor que usa la vista previa del navegador: publicación debe recibirlo tal cual. */
    public readonly markdownEngine: MarkdownEngine,
    public readonly pieceResolver: DocumentPieceResolver,
  ) {}

  static create(): RenderingModule {
    const blocks = createBlockRegistry();
    return new RenderingModule(
      blocks,
      createMarkdownEngine([createComponentBlocksExtension(blocks)]),
      new DocumentPieceResolver(blocks),
    );
  }
}
