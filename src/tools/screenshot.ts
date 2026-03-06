import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBootedDeviceOrThrow, execCommand } from "../platform.js";

const TEMP_DIR = os.tmpdir();

async function captureIos(deviceId: string): Promise<string> {
  const filePath = path.join(TEMP_DIR, `detox-mcp-${Date.now()}.png`);
  await execCommand("xcrun", [
    "simctl",
    "io",
    deviceId,
    "screenshot",
    filePath,
  ]);
  return filePath;
}

async function captureAndroid(deviceId: string): Promise<string> {
  const filePath = path.join(TEMP_DIR, `detox-mcp-${Date.now()}.png`);
  const rawOutput = await new Promise<Buffer>((resolve, reject) => {
    execFile(
      "adb",
      ["-s", deviceId, "exec-out", "screencap", "-p"],
      { encoding: "buffer", maxBuffer: 20 * 1024 * 1024, timeout: 15_000 },
      (err, stdout) => {
        if (err) reject(new Error(`adb screencap failed: ${err.message}`));
        else resolve(stdout as Buffer);
      },
    );
  });
  fs.writeFileSync(filePath, rawOutput);
  return filePath;
}

function readAndCleanup(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  fs.unlinkSync(filePath);
  return buffer.toString("base64");
}

export function registerScreenshotTool(server: McpServer) {
  server.tool(
    "screenshot",
    "Capture the current simulator/emulator screen and return it as an image",
    {
      name: z
        .string()
        .optional()
        .describe("Optional label for this screenshot"),
    },
    async ({ name }) => {
      const device = await getBootedDeviceOrThrow();
      const label = name ?? `screenshot-${Date.now()}`;

      let filePath: string;
      if (device.platform === "ios") {
        filePath = await captureIos(device.id);
      } else {
        filePath = await captureAndroid(device.id);
      }

      const base64 = readAndCleanup(filePath);

      return {
        content: [
          {
            type: "text" as const,
            text: `Screenshot "${label}" | ${device.platform} | ${device.name}`,
          },
          {
            type: "image" as const,
            data: base64,
            mimeType: "image/png",
          },
        ],
      };
    },
  );
}
