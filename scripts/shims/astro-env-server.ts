// Sustituye al módulo virtual `astro:env/server` cuando el código se ejecuta fuera de Astro (tsx).
// Solo expone lo que lee el grafo de módulos que compone `scripts/mcp-stdio.ts`.
export const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || undefined;
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || undefined;
