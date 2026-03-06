import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cdpEval } from "../metro.js";

export function registerJsEvalTool(server: McpServer) {
  server.tool(
    "js_eval",
    "Execute JavaScript in the running React Native app via Metro CDP. Returns the result. Supports await for async expressions.",
    {
      expression: z
        .string()
        .describe("JavaScript expression or statement to evaluate"),
    },
    async ({ expression }) => {
      const result = await cdpEval(expression);

      let text: string;
      if (result === undefined) {
        text = "undefined";
      } else if (typeof result === "string") {
        text = result;
      } else {
        try {
          text = JSON.stringify(result, null, 2);
        } catch {
          text = String(result);
        }
      }

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );
}
