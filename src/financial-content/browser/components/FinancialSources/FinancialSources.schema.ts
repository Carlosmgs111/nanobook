import { z } from "zod";
import {
  common,
  indexSources,
  sourceList,
} from "../../../shared/validation/financialPrimitives";

export const financialSourcesSchema = z.object({
  ...common,
  kind: z.literal("financial-sources"),
  items: sourceList,
}).strict().superRefine((block, ctx) => {
  indexSources(block.items, "items", ctx);
});
