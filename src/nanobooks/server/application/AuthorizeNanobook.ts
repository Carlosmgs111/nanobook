import type { Nanobook } from "../domain/Nanobook";

export type NanobookPermission = "read" | "write";

export class NanobookAccessDeniedError extends Error {
  constructor(
    public readonly nanobookId: string,
    public readonly permission: NanobookPermission,
  ) {
    super(`No tienes permiso de ${permission === "read" ? "lectura" : "edición"} sobre el nanobook`);
    this.name = "NanobookAccessDeniedError";
  }
}

export class AuthorizeNanobook {
  canRead(nanobook: Nanobook, userId?: string): boolean {
    return nanobook.getVisibility() === "public" || nanobook.getOwnerId() === userId;
  }

  canWrite(nanobook: Nanobook, userId?: string): boolean {
    return Boolean(userId) && nanobook.getOwnerId() === userId;
  }

  assert(
    nanobook: Nanobook,
    permission: NanobookPermission,
    userId?: string,
  ): void {
    const allowed = permission === "read"
      ? this.canRead(nanobook, userId)
      : this.canWrite(nanobook, userId);
    if (!allowed) throw new NanobookAccessDeniedError(nanobook.getId(), permission);
  }
}
