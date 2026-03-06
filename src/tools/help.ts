import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBootedDevice } from "../platform.js";

const TOOL_CATALOG = [
  {
    name: "screenshot",
    desc: "Capture simulator/emulator screen as PNG image",
    params: "name? (string)",
  },
  {
    name: "get_view_hierarchy",
    desc: "Dump UI accessibility tree with labels, types, and bounds",
    params: "format? (raw|tree), filter? (string)",
  },
  {
    name: "get_device_info",
    desc: "Show device/simulator info and connection status",
    params: "none",
  },
  {
    name: "get_device_logs",
    desc: "Capture recent console logs from simulator/emulator",
    params: "duration? (seconds), filter? (regex)",
  },
  {
    name: "start_recording",
    desc: "Start screen recording to video file",
    params: "name? (string)",
  },
  {
    name: "stop_recording",
    desc: "Stop recording and return file path",
    params: "none",
  },
  {
    name: "tap",
    desc: "Tap screen at coordinates",
    params: "x (number), y (number)",
  },
  {
    name: "type_text",
    desc: "Type text into focused input field",
    params: "text (string)",
  },
  {
    name: "press_button",
    desc: "Press device button",
    params: "button (home|back|enter|delete)",
  },
  {
    name: "scroll",
    desc: "Scroll screen in a direction",
    params: "direction (up|down|left|right), amount? (pixels, default 500)",
  },
  {
    name: "open_deeplink",
    desc: "Open URL or deep link in app",
    params: "url (string)",
  },
  {
    name: "get_metro_status",
    desc: "Check Metro bundler status and list connected RN runtimes",
    params: "none",
  },
  {
    name: "get_js_logs",
    desc: "Capture JS console output (log/warn/error) from app via Metro CDP",
    params:
      "duration? (seconds), filter? (regex), level? (all|log|warn|error|info|debug)",
  },
  {
    name: "js_eval",
    desc: "Execute JavaScript in the running app via Metro CDP",
    params: "expression (string)",
  },
  {
    name: "ping",
    desc: "Health check — device status",
    params: "none",
  },
];

export { TOOL_CATALOG };

export function registerHelpTool(server: McpServer) {
  server.tool(
    "help",
    "List all available tools with descriptions, parameters, and current system status",
    {},
    async () => {
      const device = await getBootedDevice();

      const deviceLine = device
        ? `✅ ${device.platform} | ${device.name} (${device.id})`
        : "❌ No booted simulator/emulator detected";

      const toolLines = TOOL_CATALOG.map(
        (t) =>
          `  ${t.name.padEnd(22)} ${t.desc}\n${"".padEnd(24)}params: ${t.params}`,
      ).join("\n\n");

      const text = [
        "react-native-devtools-mcp — Debug React Native apps via MCP",
        "",
        `Device: ${deviceLine}`,
        "",
        `Tools (${TOOL_CATALOG.length}):`,
        "",
        toolLines,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    },
  );
}
