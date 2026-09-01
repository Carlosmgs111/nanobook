import type { PublishService as PublishServicePort } from "../application/PublishService.port";
import { invalidatePublishedPage } from "../../publishing";

export class PublishService implements PublishServicePort {
  invalidatePage(pageId: string): Promise<void> {
    return invalidatePublishedPage.execute([pageId]);
  }
}
