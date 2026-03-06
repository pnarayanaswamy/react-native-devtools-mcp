import { execFile } from "node:child_process";

export type DeviceInfo = {
  platform: "ios" | "android";
  id: string;
  name: string;
};

let cachedDevice: DeviceInfo | null | undefined;

export function execCommand(
  command: string,
  args: string[],
  timeoutMs = 10_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(
            `${command} ${args.join(" ")} failed: ${stderr || error.message}`,
          ),
        );
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function detectIosDevice(): Promise<DeviceInfo | null> {
  try {
    const output = await execCommand("xcrun", [
      "simctl",
      "list",
      "devices",
      "booted",
      "-j",
    ]);
    const parsed = JSON.parse(output) as {
      devices: Record<
        string,
        Array<{ udid: string; name: string; state: string }>
      >;
    };

    for (const [, deviceList] of Object.entries(parsed.devices)) {
      for (const device of deviceList) {
        if (device.state === "Booted") {
          return { platform: "ios", id: device.udid, name: device.name };
        }
      }
    }
  } catch {
    // xcrun not available or no simulators
  }
  return null;
}

async function detectAndroidDevice(): Promise<DeviceInfo | null> {
  try {
    const output = await execCommand("adb", ["devices", "-l"]);
    const lines = output.split("\n").slice(1); // skip header

    for (const line of lines) {
      const match = line.match(/^(\S+)\s+device\s+(.*)$/);
      if (match) {
        const id = match[1];
        const propsStr = match[2];
        const modelMatch = propsStr.match(/model:(\S+)/);
        const name = modelMatch ? modelMatch[1].replace(/_/g, " ") : id;
        return { platform: "android", id, name };
      }
    }
  } catch {
    // adb not available
  }
  return null;
}

export async function getBootedDevice(
  forceRefresh = false,
): Promise<DeviceInfo | null> {
  if (cachedDevice !== undefined && !forceRefresh) {
    return cachedDevice;
  }

  const envPlatform = process.env["DETOX_MCP_PLATFORM"] as
    | "ios"
    | "android"
    | undefined;
  const envDeviceId = process.env["DETOX_MCP_DEVICE_ID"];

  if (envPlatform && envDeviceId) {
    cachedDevice = {
      platform: envPlatform,
      id: envDeviceId,
      name: `${envPlatform}:${envDeviceId}`,
    };
    return cachedDevice;
  }

  cachedDevice = (await detectIosDevice()) ?? (await detectAndroidDevice());
  return cachedDevice;
}

export async function getBootedDeviceOrThrow(): Promise<DeviceInfo> {
  const device = await getBootedDevice();
  if (!device) {
    throw new Error(
      "No booted simulator or emulator found.\n" +
        '  iOS: xcrun simctl boot "iPhone 15 Pro"\n' +
        "  Android: emulator -avd <avd_name>\n" +
        "  Or set DETOX_MCP_PLATFORM and DETOX_MCP_DEVICE_ID env vars.",
    );
  }
  return device;
}
