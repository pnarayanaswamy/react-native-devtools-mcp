import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureJsLogs } from "../metro.js";

const MAX_ENTRIES = 200;

export function registerJsLogsTool(server: McpServer) {
  server.tool(
    "get_js_logs",
    "Capture JavaScript console output (console.log/warn/error) from the running React Native app via Metro CDP",
    {
      duration: z
        .number()
        .optional()
        .describe("Seconds to listen for logs (default: 5, max: 30)"),
      filter: z
        .string()
        .optional()
        .describe("Regex pattern to filter log entries"),
      level: z
        .enum(["all", "log", "warn", "error", "info", "debug"])
        .optional()
        .describe("Filter by log level (default: all)"),
    },
    async ({ duration, filter, level }) => {
      const durationSec = Math.min(duration ?? 5, 30);
      const durationMs = durationSec * 1000;

      let entries = await captureJsLogs(durationMs);

      if (level && level !== "all") {
        entries = entries.filter((e) => e.level === level);
      }

      if (filter) {
        const pattern = new RegExp(filter, "i");
        entries = entries.filter((e) => pattern.test(e.text));
      }

      const truncated = entries.length > MAX_ENTRIES;
      const displayed = entries.slice(-MAX_ENTRIES);

      const lines = displayed.map((e) => {
        const ts = new Date(e.timestamp).toISOString().slice(11, 23);
        return `[${ts}] ${e.level.toUpperCase().padEnd(5)} ${e.text}`;
      });

      const header = truncated
        ? `[Showing last ${MAX_ENTRIES} of ${entries.length} entries]`
        : `[${entries.length} entries captured in ${durationSec}s]`;

      const text =
        lines.length > 0
          ? `${header}\n${lines.join("\n")}`
          : `No JS console output captured in ${durationSec}s. Is the app running?`;

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );
}
