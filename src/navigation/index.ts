import { NavigationService } from "./application/NavigationService";
import { ContentService } from "./infraestructure/ContentService";
import { DocumentGraphService } from "./infraestructure/DocumentGraphService";

const contentService = new ContentService();
const documents = await contentService.listDocuments();
export const graphService = new DocumentGraphService(documents);

// TODO Revisar mover esta composicion a un punto unico por encima
export const navigationService = new NavigationService(graphService);
