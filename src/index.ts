#!/usr/bin/env node

console.log = console.error.bind(console);

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const server = createServer();

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("react-native-devtools-mcp: connected via stdio");
}

main().catch((error: unknown) => {
  console.error("react-native-devtools-mcp fatal:", error);
  process.exit(1);
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
