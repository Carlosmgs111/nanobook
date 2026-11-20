/**
 * Servidor MCP de Nanobook por STDIO: el cliente (Claude, Codex…) lanza este proceso en la misma
 * máquina y habla con él por la entrada y la salida estándar, sin HTTP ni OAuth.
 *
 * Identidad: el usuario local cuyo correo indica NANOBOOK_MCP_USER_EMAIL (debe existir en la base).
 * IMPORTANTE: stdout es el canal del protocolo; todo log va a stderr.
 */

// Cualquier `console.log` de los módulos rompería el protocolo si saliera por stdout.
for (const method of ["log", "info", "debug", "warn"] as const) {
  console[method] = (...args: unknown[]) => console.error(...args);
}

const { selectMcpTransport } = await import("../src/agents/server/infrastructure/mcp/selectMcpTransport");
if (selectMcpTransport(process.env) !== "stdio") {
  console.error("El canal STDIO es solo para uso local; un despliegue (VERCEL=1) sirve el MCP por HTTP en /mcp.");
  process.exit(1);
}

const email = process.env.NANOBOOK_MCP_USER_EMAIL?.trim();
if (!email) {
  console.error("Define NANOBOOK_MCP_USER_EMAIL con el correo de un usuario existente de la base.");
  process.exit(1);
}

const { eq } = await import("drizzle-orm");
const { db, client } = await import("../src/shared/infrastructure/database/drizzleDatabase");
const { getDatabaseOptions } = await import("../src/shared/infrastructure/database/databaseConfig");
const { user } = await import("../src/auth/server/infrastructure/better-auth/DrizzleAuthSchema");
const { describeDatabaseTarget } = await import("./describeDatabaseTarget");

const [found] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
if (!found) {
  console.error(`No existe ningún usuario con el correo indicado en la base (${describeDatabaseTarget(getDatabaseOptions().url)}).`);
  client.close();
  process.exit(1);
}

const { createAuthorizer } = await import("../src/authorization/server");
const { NanobookModule } = await import("../src/nanobooks/server");
const { RenderingModule } = await import("../src/rendering/server");
const { FinancialContentModule } = await import("../src/financial-content/browser");
const { SpreadsheetsModule } = await import("../src/spreadsheets/browser");
const { AgentModule } = await import("../src/agents/server");
const { InMemoryEventBus } = await import("../src/shared/infrastructure/InMemoryEventBus");
const { createStdioActor, startStdioMcpServer } = await import(
  "../src/agents/server/infrastructure/stdio/startStdioMcpServer"
);

const eventBus = new InMemoryEventBus();
const authorization = createAuthorizer();
const nanobooks = await NanobookModule.create(eventBus, authorization);
const rendering = RenderingModule.create(eventBus);
const financialContent = FinancialContentModule.create(rendering.blocks);
SpreadsheetsModule.create(rendering.blocks);
const agents = AgentModule.create(nanobooks, financialContent.markdownBlockAdvisor, authorization);

console.error(`Nanobook MCP (STDIO) listo. Base: ${describeDatabaseTarget(getDatabaseOptions().url)}.`);
await startStdioMcpServer(createStdioActor(found.id), agents.tools);
