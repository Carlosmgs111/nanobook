import {
  createWorkflowContext,
  detectWorkflowChanges,
  printChanges,
  printInvalidation,
  renderInvalidatedPages,
} from "./lib/content-workflow";
import {
  loadSnapshot,
  saveSnapshot,
} from "../src/document/change/snapshot";

const VALID_COMMANDS = ["status", "render"];

type Command = (typeof VALID_COMMANDS)[number];

function isValidCommand(arg: string): arg is Command {
  return VALID_COMMANDS.includes(arg);
}

function showUsage(): void {
  console.log("Usage: pnpm content:<status|render>");
  console.log("  status  - Detect changes and print invalidated documents.");
  console.log("  render  - Detect changes, render invalidated bodies and update cache.");
}

async function runStatus() {
  const context = createWorkflowContext();
  const { changes } = await detectWorkflowChanges(context);

  printChanges(changes);

  if (changes.length > 0) {
    const invalidation = await context.changeService.getInvalidatedIds(changes);
    printInvalidation(invalidation);
  }
}

async function runRender() {
  const context = createWorkflowContext();
  const { changes, currentHashes } = await detectWorkflowChanges(context);

  printChanges(changes);

  if (changes.length === 0) {
    console.log("\nNothing to render.");
    return;
  }

  const invalidation = await context.changeService.getInvalidatedIds(changes);
  printInvalidation(invalidation);

  await renderInvalidatedPages(
    context,
    invalidation.invalidatedIds,
    invalidation.removedIds,
    currentHashes,
  );

  await saveSnapshot(currentHashes);
  console.log("\nSnapshot updated.");
}

async function main() {
  const command = process.argv[2] ?? "status";

  if (!isValidCommand(command)) {
    showUsage();
    process.exit(1);
  }

  if (command === "status") {
    await runStatus();
  } else {
    await runRender();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
