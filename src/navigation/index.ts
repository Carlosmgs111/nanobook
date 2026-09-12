import type { Document } from "../document/domain/Document";
export type { NavigationService };
export type {
  Crumb,
  NavigationNode,
  ParentEntry,
  InvalidationResult,
} from "./domain/types";
import { NavigationService } from "./application/NavigationService";
import { DocumentsGraph } from "./infraestructure/DocumentsGraph";

export class NavigationModule {
  constructor(public readonly navigationService: NavigationService) {}

  static async create(documents: Document[]) {
    const documentGraph = new DocumentsGraph(documents);
    // TODO Revisar mover esta composicion a un punto unico por encima
    const navigationService = new NavigationService(documentGraph);
    return new NavigationModule(navigationService);
  }
}
