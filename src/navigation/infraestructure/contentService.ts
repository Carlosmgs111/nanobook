import type {ContentServices as ContentServicesPort } from "../application/ContentServicesPort";
import { contentRepository } from "../../document/_index";
import type { Document } from "../../document/_domain/types";

export class ContentService implements ContentServicesPort {
  async listDocuments(): Promise<Document[]> {
    return await contentRepository.list();
  }
}