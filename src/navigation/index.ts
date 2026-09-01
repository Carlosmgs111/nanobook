import type { Document } from "../document/domain/Document";
import { NavigationService } from "./application/NavigationService";
export type { NavigationService };
import { DocumentsGraph } from "./infraestructure/DocumentsGraph";
export type {
  Crumb,
  NavigationNode,
  ParentEntry,
  InvalidationResult,
} from "./domain/types";

export class NavigationModule {
  constructor(public navigationService: NavigationService) {}

  static async create(documents: Document[]) {
    const documentGraph = new DocumentsGraph(documents);
    // TODO Revisar mover esta composicion a un punto unico por encima
    const navigationService = new NavigationService(documentGraph);
    return new NavigationModule(navigationService);
  }
}
