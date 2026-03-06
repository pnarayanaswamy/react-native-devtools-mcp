import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBootedDeviceOrThrow, execCommand } from "../platform.js";

type IdbElement = {
  AXLabel: string | null;
  AXValue: string | null;
  AXUniqueId: string | null;
  type: string;
  role: string;
  role_description: string;
  enabled: boolean;
  frame: { x: number; y: number; width: number; height: number };
  custom_actions: string[];
  help: string | null;
};

function resolveIdbPath(): string {
  const envPath = process.env["RN_DEVTOOLS_IDB_PATH"];
  if (envPath) return envPath;

  const candidates = [
    "/Users/" +
      (process.env["USER"] ?? process.env["HOME"]?.split("/").pop()) +
      "/Library/Python/3.9/bin/idb",
    "/usr/local/bin/idb",
    "/opt/homebrew/bin/idb",
    "idb",
  ];

  return (
    candidates.find((c) => {
      try {
        require("node:child_process").execFileSync(c, ["--help"], {
          timeout: 3000,
          stdio: "ignore",
        });
        return true;
      } catch {
        return false;
      }
    }) ?? "idb"
  );
}

let cachedIdbPath: string | undefined;
function getIdbPath(): string {
  if (!cachedIdbPath) cachedIdbPath = resolveIdbPath();
  return cachedIdbPath;
}

async function dumpIosHierarchy(deviceId: string): Promise<string> {
  const idb = getIdbPath();
  return execCommand(idb, ["ui", "describe-all", "--udid", deviceId], 15_000);
}

async function dumpAndroidHierarchy(deviceId: string): Promise<string> {
  const remotePath = "/sdcard/detox-mcp-hierarchy.xml";
  await execCommand(
    "adb",
    ["-s", deviceId, "shell", "uiautomator", "dump", remotePath],
    15_000,
  );
  const xml = await execCommand(
    "adb",
    ["-s", deviceId, "shell", "cat", remotePath],
    10_000,
  );
  await execCommand("adb", [
    "-s",
    deviceId,
    "shell",
    "rm",
    "-f",
    remotePath,
  ]).catch(() => {});
  return xml;
}

function formatIdbElements(raw: string, filter?: string): string {
  let elements: IdbElement[];
  try {
    elements = JSON.parse(raw) as IdbElement[];
  } catch {
    return raw;
  }

  if (!Array.isArray(elements) || elements.length === 0) {
    return "No accessibility elements found on screen.";
  }

  const lines: string[] = [];
  for (const el of elements) {
    const label = el.AXLabel ?? "";
    const value = el.AXValue ?? "";
    const uid = el.AXUniqueId ?? "";
    const type = el.type ?? el.role_description ?? "";

    if (filter) {
      const f = filter.toLowerCase();
      const searchable = `${label} ${value} ${uid} ${type}`.toLowerCase();
      if (!searchable.includes(f)) continue;
    }

    const { x, y, width, height } = el.frame;
    const bounds = `(${Math.round(x)},${Math.round(y)} ${Math.round(width)}x${Math.round(height)})`;

    const parts = [type];
    if (uid) parts.push(`[${uid}]`);
    if (label) parts.push(`"${label}"`);
    if (value && value !== label) parts.push(`val="${value}"`);
    parts.push(bounds);
    if (!el.enabled) parts.push("(disabled)");

    lines.push(parts.join(" "));
  }

  if (lines.length === 0) {
    return filter
      ? `No elements matching "${filter}".`
      : "No accessibility elements found on screen.";
  }

  return `${lines.length} elements\n${"─".repeat(60)}\n${lines.join("\n")}`;
}

function formatAndroidXmlAsTree(xml: string, filter?: string): string {
  const nodeRegex = /<node\s+([^>]+)\/?>|<node\s+([^>]+)>/g;
  const lines: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = nodeRegex.exec(xml)) !== null) {
    const attrs = match[1] || match[2];

    const get = (name: string): string => {
      const m = new RegExp(`${name}="([^"]*)"`, "i").exec(attrs);
      return m ? m[1] : "";
    };

    const resourceId = get("resource-id");
    const text = get("text");
    const className = get("class").split(".").pop() ?? get("class");
    const bounds = get("bounds");
    const testId = resourceId.split("/").pop() ?? resourceId;

    if (
      filter &&
      !testId.includes(filter) &&
      !text.includes(filter) &&
      !className.includes(filter)
    ) {
      continue;
    }

    const parts = [className];
    if (testId) parts.push(`[${testId}]`);
    if (text) parts.push(`"${text.slice(0, 60)}"`);
    if (bounds) parts.push(bounds);

    lines.push(parts.join(" "));
  }

  return lines.length > 0
    ? `${lines.length} elements\n${"─".repeat(60)}\n${lines.join("\n")}`
    : "No elements found (or XML format not recognized).";
}

export function registerViewHierarchyTool(server: McpServer) {
  server.tool(
    "get_view_hierarchy",
    "Dump the current UI accessibility tree with labels, types, frames, and testIDs. Requires Facebook IDB on iOS.",
    {
      format: z
        .enum(["raw", "tree"])
        .optional()
        .describe(
          "Output format: raw (JSON on iOS, XML on Android) or formatted tree (default: tree)",
        ),
      filter: z
        .string()
        .optional()
        .describe("Filter elements by label, testID, value, or type"),
    },
    async ({ format, filter }) => {
      const device = await getBootedDeviceOrThrow();
      const outputFormat = format ?? "tree";

      let raw: string;
      if (device.platform === "ios") {
        raw = await dumpIosHierarchy(device.id);
      } else {
        raw = await dumpAndroidHierarchy(device.id);
      }

      let output: string;
      if (outputFormat === "raw") {
        output = raw;
      } else if (device.platform === "ios") {
        output = formatIdbElements(raw, filter ?? undefined);
      } else {
        output = formatAndroidXmlAsTree(raw, filter ?? undefined);
      }

      return {
        content: [{ type: "text" as const, text: output }],
      };
    },
  );
}
