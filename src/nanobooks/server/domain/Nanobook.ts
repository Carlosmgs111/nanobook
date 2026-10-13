import { Result } from "../../../shared/domain/Result";
import {
  InvalidNanobookError,
  InvalidNanobookSlugError,
} from "./errors";
import type {
  CreateNanobookData,
  NanobookSettings,
  NanobookVisibility,
  PersistedNanobook,
} from "./types";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export class Nanobook {
  private constructor(
    private readonly id: string,
    private readonly ownerId: string,
    private readonly slug: string,
    private readonly name: string,
    private readonly visibility: NanobookVisibility,
    private readonly settings: NanobookSettings,
    private readonly contentVersion: number,
    private readonly createdAt: Date,
    private readonly updatedAt: Date,
  ) {}

  static create(
    data: CreateNanobookData,
  ): Result<InvalidNanobookError | InvalidNanobookSlugError, Nanobook> {
    const id = data.id.trim();
    if (!id) return Result.fail(new InvalidNanobookError("id es obligatorio"));

    const ownerId = data.ownerId.trim();
    if (!ownerId) {
      return Result.fail(new InvalidNanobookError("ownerId es obligatorio"));
    }

    const slug = data.slug.trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug)) {
      return Result.fail(new InvalidNanobookSlugError(data.slug));
    }

    const name = data.name.trim();
    if (!name) return Result.fail(new InvalidNanobookError("name es obligatorio"));

    if (data.visibility && !["public", "private"].includes(data.visibility)) {
      return Result.fail(new InvalidNanobookError("visibility es inválida"));
    }
    if (
      data.contentVersion !== undefined &&
      (!Number.isInteger(data.contentVersion) || data.contentVersion < 0)
    ) {
      return Result.fail(new InvalidNanobookError("contentVersion es inválida"));
    }

    const settings = data.settings ?? {};
    if (!isNanobookSettings(settings)) {
      return Result.fail(
        new InvalidNanobookError(
          `settings contiene campos no permitidos: ${Object.keys(settings as object).join(", ")}`,
        ),
      );
    }

    const createdAt = data.createdAt ?? new Date();
    const updatedAt = data.updatedAt ?? createdAt;
    return Result.ok(
      new Nanobook(
        id,
        ownerId,
        slug,
        name,
        data.visibility ?? "private",
        { ...settings },
        data.contentVersion ?? 0,
        createdAt,
        updatedAt,
      ),
    );
  }

  getId(): string { return this.id; }
  getOwnerId(): string { return this.ownerId; }
  getSlug(): string { return this.slug; }
  getName(): string { return this.name; }
  getVisibility(): NanobookVisibility { return this.visibility; }
  getContentVersion(): number { return this.contentVersion; }
  getSettings(): NanobookSettings { return { ...this.settings }; }

  toPersistence(): PersistedNanobook {
    return {
      id: this.id,
      ownerId: this.ownerId,
      slug: this.slug,
      name: this.name,
      visibility: this.visibility,
      settings: this.getSettings(),
      contentVersion: this.contentVersion,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

function isNanobookSettings(value: unknown): value is NanobookSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).length === 0;
}
