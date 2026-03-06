import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBootedDevice } from "./platform.js";
import { registerScreenshotTool } from "./tools/screenshot.js";
import { registerViewHierarchyTool } from "./tools/view-hierarchy.js";
import { registerDeviceInfoTool } from "./tools/device-info.js";
import { registerDeviceLogsTool } from "./tools/device-logs.js";
import { registerRecordingTool } from "./tools/recording.js";
import { registerInteractionTools } from "./tools/interactions.js";
import { registerHelpTool } from "./tools/help.js";
import { registerMetroStatusTool } from "./tools/metro-status.js";
import { registerJsLogsTool } from "./tools/js-logs.js";
import { registerJsEvalTool } from "./tools/js-eval.js";

export {
  registerScreenshotTool,
  registerViewHierarchyTool,
  registerDeviceInfoTool,
  registerDeviceLogsTool,
  registerRecordingTool,
  registerInteractionTools,
  registerHelpTool,
  registerMetroStatusTool,
  registerJsLogsTool,
  registerJsEvalTool,
};

export {
  getBootedDevice,
  getBootedDeviceOrThrow,
  execCommand,
} from "./platform.js";
export type { DeviceInfo } from "./platform.js";
export { TOOL_CATALOG } from "./tools/help.js";

export {
  getMetroTargets,
  getMetroStatus,
  cdpEval,
  captureJsLogs,
  getMetroBaseUrl,
} from "./metro.js";

export type CreateServerOptions = {
  name?: string;
  version?: string;
};

export function createServer(options?: CreateServerOptions): McpServer {
  const server = new McpServer({
    name: options?.name ?? "react-native-devtools-mcp",
    version: options?.version ?? "0.1.0",
  });

  server.tool(
    "ping",
    "Health check — returns device info and connection status",
    {},
    async () => {
      const device = await getBootedDevice();
      const deviceStatus = device
        ? `${device.platform} | ${device.name} (${device.id})`
        : "No booted simulator/emulator detected";

      return {
        content: [
          {
            type: "text" as const,
            text: `${options?.name ?? "react-native-devtools-mcp"} is running\nDevice: ${deviceStatus}`,
          },
        ],
      };
    },
  );

  registerScreenshotTool(server);
  registerViewHierarchyTool(server);
  registerDeviceInfoTool(server);
  registerDeviceLogsTool(server);
  registerRecordingTool(server);
  registerInteractionTools(server);
  registerMetroStatusTool(server);
  registerJsLogsTool(server);
  registerJsEvalTool(server);
  registerHelpTool(server);

  return server;
}
