/** El documento ya no contiene la hoja tal como la cargó el lector. */
export class SheetNotFoundError extends Error {
  constructor() {
    super("La hoja ya no coincide con el documento: recarga la página.");
    this.name = "SheetNotFoundError";
  }
}

/** El cambio pedido no produce una hoja válida. */
export class InvalidSheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSheetError";
  }
}

export class SheetDocumentNotFoundError extends Error {
  constructor(public readonly documentPath: string) {
    super(`El documento "${documentPath}" no existe`);
    this.name = "SheetDocumentNotFoundError";
  }
}

/** El documento cambió entre la lectura y el guardado. */
export class SheetRevisionConflictError extends Error {
  constructor() {
    super("El documento cambió mientras editabas: recarga la página.");
    this.name = "SheetRevisionConflictError";
  }
}

export class SheetWriteError extends Error {
  constructor(cause: unknown) {
    super("No se pudo guardar el documento", { cause });
    this.name = "SheetWriteError";
  }
}
