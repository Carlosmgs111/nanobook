import type { APIRoute } from "astro";
import { AstroCollectionRepository } from "../../core/content/adapters/astro-collection-repository";
import type { Document } from "../../core/content/types";

export const prerender = (import.meta.env as any).OUTPUT_MODE !== "dynamic";
export const getStaticPaths = () => [];

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const { slug } = params;
    if (!slug) {
      return new Response("Falta el parámetro slug", { status: 400 });
    }
    const repository = new AstroCollectionRepository();
    const document: Document = JSON.parse(await request.text());
    await repository.save(document);
    return new Response("Save Successfully", { status: 200 });
  } catch (error) {
    return new Response("Error", { status: 500 });
  }
};
