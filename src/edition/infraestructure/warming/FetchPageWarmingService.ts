import { Result } from "../../../shared/domain/Result";
import type { PageWarmingService } from "../../domain/ports/PageWarmingService";
import { EditionStorageError } from "../../domain/errors";

type PageFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export class FetchPageWarmingService implements PageWarmingService {
  constructor(private fetchPage: PageFetch = fetch) {}

  async warm(href: string): Promise<Result<EditionStorageError, void>> {
    try {
      await this.fetchPage(href, { credentials: "same-origin" });
      return Result.ok();
    } catch (error) {
      return Result.ok();
    }
  }
}
