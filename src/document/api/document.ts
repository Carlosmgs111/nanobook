import type { APIRoute } from "astro";
import { createContentRepository } from "../adapters/repository/factory";
import type { Document } from "../model/types";

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const { slug } = params;
    if (!slug) {
      return new Response("Falta el parámetro slug", { status: 400 });
    }
    const repository = await createContentRepository();
    const document: Document = JSON.parse(await request.text());
    await repository.save(document);
    return new Response("Save Successfully", { status: 200 });
  } catch (error) {
    return new Response("Error", { status: 500 });
  }
};
