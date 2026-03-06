import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBootedDeviceOrThrow, execCommand } from "../platform.js";

const MAX_LINES = 200;

async function getIosLogs(
  deviceId: string,
  durationSec: number,
): Promise<string> {
  return execCommand(
    "xcrun",
    [
      "simctl",
      "spawn",
      deviceId,
      "log",
      "show",
      "--last",
      `${durationSec}s`,
      "--predicate",
      'process == "MetaMask" OR process == "MetaMask-Flask"',
      "--style",
      "compact",
    ],
    30_000,
  );
}

async function getAndroidLogs(
  deviceId: string,
  durationSec: number,
): Promise<string> {
  return execCommand(
    "adb",
    ["-s", deviceId, "logcat", "-d", "-t", `${durationSec}`, "*:I"],
    15_000,
  );
}

function filterAndTruncate(raw: string, filter?: string): string {
  let lines = raw.split("\n");

  if (filter) {
    const pattern = new RegExp(filter, "i");
    lines = lines.filter((l) => pattern.test(l));
  }

  const truncated = lines.length > MAX_LINES;
  const result = lines.slice(-MAX_LINES).join("\n");

  return truncated
    ? `[Showing last ${MAX_LINES} of ${lines.length} lines]\n${result}`
    : result;
}

export function registerDeviceLogsTool(server: McpServer) {
  server.tool(
    "get_device_logs",
    "Capture recent device console logs from the simulator/emulator",
    {
      duration: z
        .number()
        .optional()
        .describe("How many seconds back to look (default: 30)"),
      filter: z
        .string()
        .optional()
        .describe("Regex pattern to filter log lines"),
    },
    async ({ duration, filter }) => {
      const device = await getBootedDeviceOrThrow();
      const durationSec = duration ?? 30;

      let raw: string;
      if (device.platform === "ios") {
        raw = await getIosLogs(device.id, durationSec);
      } else {
        raw = await getAndroidLogs(device.id, durationSec);
      }

      const output = filterAndTruncate(raw, filter ?? undefined);

      return {
        content: [
          { type: "text" as const, text: output || "No log output captured." },
        ],
      };
    },
  );
}
