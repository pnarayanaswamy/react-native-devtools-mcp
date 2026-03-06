import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBootedDeviceOrThrow } from "../platform.js";

let activeRecording: {
  process: ChildProcess;
  filePath: string;
  platform: string;
} | null = null;

export function registerRecordingTool(server: McpServer) {
  server.tool(
    "start_recording",
    "Start recording the simulator/emulator screen to a video file",
    { name: z.string().optional().describe("Name for the recording file") },
    async ({ name }) => {
      if (activeRecording) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Recording already in progress: ${activeRecording.filePath}\nCall stop_recording first.`,
            },
          ],
        };
      }

      const device = await getBootedDeviceOrThrow();
      const fileName = `${name ?? "recording"}-${Date.now()}.mp4`;
      const filePath = path.join(os.tmpdir(), fileName);

      let proc: ChildProcess;
      if (device.platform === "ios") {
        proc = spawn(
          "xcrun",
          ["simctl", "io", device.id, "recordVideo", filePath],
          { stdio: "ignore" },
        );
      } else {
        proc = spawn(
          "adb",
          [
            "-s",
            device.id,
            "shell",
            "screenrecord",
            "/sdcard/detox-mcp-recording.mp4",
          ],
          { stdio: "ignore" },
        );
      }

      activeRecording = { process: proc, filePath, platform: device.platform };

      return {
        content: [
          { type: "text" as const, text: `Recording started → ${filePath}` },
        ],
      };
    },
  );

  server.tool(
    "stop_recording",
    "Stop the current screen recording and return the file path",
    {},
    async () => {
      if (!activeRecording) {
        return {
          content: [
            { type: "text" as const, text: "No active recording to stop." },
          ],
        };
      }

      const { process: proc, filePath, platform } = activeRecording;

      proc.kill("SIGINT");
      await new Promise<void>((resolve) => {
        proc.on("exit", () => resolve());
        setTimeout(resolve, 3000);
      });

      if (platform === "android") {
        const device = await getBootedDeviceOrThrow();
        const { execCommand } = await import("../platform.js");
        await execCommand(
          "adb",
          [
            "-s",
            device.id,
            "pull",
            "/sdcard/detox-mcp-recording.mp4",
            filePath,
          ],
          15_000,
        );
        await execCommand("adb", [
          "-s",
          device.id,
          "shell",
          "rm",
          "-f",
          "/sdcard/detox-mcp-recording.mp4",
        ]).catch(() => {});
      }

      activeRecording = null;

      return {
        content: [
          { type: "text" as const, text: `Recording saved → ${filePath}` },
        ],
      };
    },
  );
}
