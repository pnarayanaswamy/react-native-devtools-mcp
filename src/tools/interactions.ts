import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBootedDeviceOrThrow, execCommand } from "../platform.js";

export function registerInteractionTools(server: McpServer) {
  server.tool(
    "tap",
    "Tap on the screen at given coordinates",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
    },
    async ({ x, y }) => {
      const device = await getBootedDeviceOrThrow();

      if (device.platform === "ios") {
        await execCommand("xcrun", [
          "simctl",
          "io",
          device.id,
          "tap",
          String(x),
          String(y),
        ]);
      } else {
        await execCommand("adb", [
          "-s",
          device.id,
          "shell",
          "input",
          "tap",
          String(x),
          String(y),
        ]);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Tapped at (${x}, ${y}) on ${device.platform}`,
          },
        ],
      };
    },
  );

  server.tool(
    "type_text",
    "Type text into the currently focused input field",
    { text: z.string().describe("Text to type") },
    async ({ text }) => {
      const device = await getBootedDeviceOrThrow();

      if (device.platform === "ios") {
        for (const char of text) {
          await execCommand("xcrun", [
            "simctl",
            "io",
            device.id,
            "keyboard",
            "type",
            char,
          ]);
        }
      } else {
        const escaped = text.replace(/ /g, "%s").replace(/"/g, '\\"');
        await execCommand("adb", [
          "-s",
          device.id,
          "shell",
          "input",
          "text",
          escaped,
        ]);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Typed "${text}" on ${device.platform}`,
          },
        ],
      };
    },
  );

  server.tool(
    "press_button",
    "Press a device button (home, back, enter, delete)",
    {
      button: z
        .enum(["home", "back", "enter", "delete"])
        .describe("Button to press"),
    },
    async ({ button }) => {
      const device = await getBootedDeviceOrThrow();

      const androidKeyMap: Record<string, string> = {
        home: "KEYCODE_HOME",
        back: "KEYCODE_BACK",
        enter: "KEYCODE_ENTER",
        delete: "KEYCODE_DEL",
      };

      if (device.platform === "android") {
        await execCommand("adb", [
          "-s",
          device.id,
          "shell",
          "input",
          "keyevent",
          androidKeyMap[button],
        ]);
      } else {
        const iosKeyMap: Record<string, string[]> = {
          home: ["simctl", "io", device.id, "keypress", "home"],
          back: ["simctl", "io", device.id, "keypress", "escape"],
          enter: ["simctl", "io", device.id, "keypress", "return"],
          delete: ["simctl", "io", device.id, "keypress", "delete"],
        };
        await execCommand("xcrun", iosKeyMap[button]);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Pressed ${button} on ${device.platform}`,
          },
        ],
      };
    },
  );

  server.tool(
    "scroll",
    "Scroll the screen in a direction",
    {
      direction: z
        .enum(["up", "down", "left", "right"])
        .describe("Scroll direction"),
      amount: z
        .number()
        .optional()
        .describe("Scroll amount in pixels (default: 500)"),
    },
    async ({ direction, amount }) => {
      const device = await getBootedDeviceOrThrow();
      const distance = amount ?? 500;

      const centerX = 540;
      const centerY = 960;

      const swipeMap: Record<string, [number, number, number, number]> = {
        up: [centerX, centerY + distance / 2, centerX, centerY - distance / 2],
        down: [
          centerX,
          centerY - distance / 2,
          centerX,
          centerY + distance / 2,
        ],
        left: [
          centerX + distance / 2,
          centerY,
          centerX - distance / 2,
          centerY,
        ],
        right: [
          centerX - distance / 2,
          centerY,
          centerX + distance / 2,
          centerY,
        ],
      };

      const [x1, y1, x2, y2] = swipeMap[direction];

      if (device.platform === "android") {
        await execCommand("adb", [
          "-s",
          device.id,
          "shell",
          "input",
          "swipe",
          String(x1),
          String(y1),
          String(x2),
          String(y2),
          "300",
        ]);
      } else {
        await execCommand("xcrun", [
          "simctl",
          "io",
          device.id,
          "swipe",
          String(x1),
          String(y1),
          String(x2),
          String(y2),
        ]);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Scrolled ${direction} by ${distance}px on ${device.platform}`,
          },
        ],
      };
    },
  );

  server.tool(
    "open_deeplink",
    "Open a URL or deep link in the app (e.g., metamask://dapp/example.com)",
    { url: z.string().describe("URL or deep link to open") },
    async ({ url }) => {
      const device = await getBootedDeviceOrThrow();

      if (device.platform === "ios") {
        await execCommand("xcrun", ["simctl", "openurl", device.id, url]);
      } else {
        await execCommand("adb", [
          "-s",
          device.id,
          "shell",
          "am",
          "start",
          "-a",
          "android.intent.action.VIEW",
          "-d",
          url,
        ]);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Opened ${url} on ${device.platform}`,
          },
        ],
      };
    },
  );
}
