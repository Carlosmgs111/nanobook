// export type { RenderedPageCache as CacheAdapter } from "../../publishing/domain/cache";

export interface PublishService {    
    invalidatePage(pageId: string): Promise<void>;
}
