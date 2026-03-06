import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBootedDevice } from "../platform.js";

export function registerDeviceInfoTool(server: McpServer) {
  server.tool(
    "get_device_info",
    "Show current device/simulator/emulator info and connection status",
    {},
    async () => {
      const device = await getBootedDevice();

      const text = device
        ? `Platform: ${device.platform}\nDevice: ${device.name} (${device.id})\nState: Booted`
        : "No booted simulator or emulator detected.\n\n" +
          '  iOS: xcrun simctl boot "iPhone 15 Pro"\n' +
          "  Android: emulator -avd <avd_name>\n" +
          "  Or set DETOX_MCP_PLATFORM and DETOX_MCP_DEVICE_ID env vars.";

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );
}
