export const POST = async (context: Parameters<import("astro").APIRoute>[0]) => {
  void context;
  return new Response("Webhook de GitHub no disponible: el contenido usa SQL", {
    status: 410,
  });
};
