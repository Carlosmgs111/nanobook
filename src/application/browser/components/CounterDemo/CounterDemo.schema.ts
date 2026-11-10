import { z } from "zod";

export const counterDemoProps = z.object({
  label: z.string().max(80).default("Contador"),
  start: z.number().int().default(0),
});
