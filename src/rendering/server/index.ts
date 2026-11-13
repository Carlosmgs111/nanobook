import {
  createComponentBlocksExtension,
  createMarkdownEngine,
  registerBlocks,
  type BlockRegistry,
  type ComponentBlockDefinition,
  type MarkdownEngine,
} from "../shared";
import { DocumentPieceResolver } from "./DocumentPieceResolver";

export type { DocumentPiece } from "./DocumentPieceResolver";

export class RenderingModule {
  private constructor(
    public readonly blocks: BlockRegistry,
    /** El mismo motor que usa la vista previa del navegador: publicación debe recibirlo tal cual. */
    public readonly markdownEngine: MarkdownEngine,
    public readonly pieceResolver: DocumentPieceResolver,
  ) {}

  static create(definitions: readonly ComponentBlockDefinition[]): RenderingModule {
    const blocks = registerBlocks(definitions);
    return new RenderingModule(
      blocks,
      createMarkdownEngine([createComponentBlocksExtension(blocks)]),
      new DocumentPieceResolver(blocks),
    );
  }
}
