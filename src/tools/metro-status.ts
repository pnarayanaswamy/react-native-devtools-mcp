import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMetroStatus, getMetroTargets, getMetroBaseUrl } from "../metro.js";

export function registerMetroStatusTool(server: McpServer) {
  server.tool(
    "get_metro_status",
    "Check if Metro bundler is running and list connected React Native runtimes",
    {},
    async () => {
      const lines: string[] = [];

      try {
        const status = await getMetroStatus();
        lines.push(
          `Metro: running (${getMetroBaseUrl()})`,
          `Status: ${status}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lines.push(
          `Metro: not reachable (${getMetroBaseUrl()})`,
          `Error: ${msg}`,
        );
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      }

      try {
        const targets = await getMetroTargets();
        lines.push("", `Connected runtimes (${targets.length}):`);
        for (const t of targets) {
          lines.push(`  - ${t.title} [${t.type}] id=${t.id}`);
        }
        if (targets.length === 0) {
          lines.push("  (none — is the app running?)");
        }
      } catch {
        lines.push("", "Could not list runtimes.");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    },
  );
}
