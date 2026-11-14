import type { BlockRegistry } from "../../rendering/shared";
import { spreadsheetBlocks } from "./blocks";

export class SpreadsheetsModule {
  private constructor() {}

  /** Registra sus bloques en `blocks`: solo existen en la aplicación que compone este módulo. */
  static create(blocks: BlockRegistry): SpreadsheetsModule {
    blocks.register(spreadsheetBlocks);
    return new SpreadsheetsModule();
  }
}
