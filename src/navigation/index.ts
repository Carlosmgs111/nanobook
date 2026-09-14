export type { NavigationService };
export type {
  Crumb,
  NavigationNode,
  ParentEntry,
  InvalidationResult,
} from "./domain/types";
export type { DocumentProvider } from "./domain/ports/DocumentProvider";
import { NavigationService } from "./application/NavigationService";
import { DocumentsGraph } from "./infraestructure/DocumentsGraph";
import type { DocumentProvider } from "./domain/ports/DocumentProvider";

export class NavigationModule {
  constructor(public readonly navigationService: NavigationService) {}

  static async create(documentProvider: DocumentProvider) {
    const documents = await documentProvider.getAll();
    const documentGraph = new DocumentsGraph(documents);
    const navigationService = new NavigationService(documentGraph);
    return new NavigationModule(navigationService);
  }
}
