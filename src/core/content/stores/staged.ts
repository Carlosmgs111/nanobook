import type { Document } from "../types";
import { atom } from "nanostores";

export const $stagedDocument = atom<Document | null>(null);

$stagedDocument.subscribe((document) => {
  console.log(document);
});
