# react-native-devtools-mcp

MCP server that gives AI agents eyes, hands, and X-ray vision into any React Native app running in an iOS simulator or Android emulator.

- Capture screenshots and screen recordings
- Inspect the full UI accessibility tree with element labels, types, and bounds
- Interact with the app: tap, type, scroll, press buttons, open deep links
- Capture device-level console logs (simctl/logcat) and JS-level console output (via Metro CDP)
- Execute arbitrary JavaScript inside the running app
- Check Metro bundler status and connected runtimes

Works with any MCP-compatible AI agent: OpenCode, Claude Code, Cursor, Windsurf, etc.

## Prerequisites

- **Node.js** >= 20
- **iOS**: Xcode with Simulator, plus Facebook IDB for view hierarchy:
  ```bash
  brew tap facebook/fb && brew install idb-companion
  pip3 install fb-idb
  ```
- **Android**: Android SDK with `adb` on PATH and a configured emulator

## Quick Start

### 1. Build

```bash
cd ~/react-native-devtools-mcp
npm install
npm run build
```

### 2. Boot a simulator or emulator

```bash
# iOS
xcrun simctl boot "iPhone 15 Pro"

# Android
emulator -avd <avd_name>
```

### 3. Configure your AI tool

**OpenCode** — add to `~/.config/opencode/opencode.json`:

```json
{
  "mcpServers": {
    "react-native": {
      "command": "node",
      "args": ["/absolute/path/to/react-native-devtools-mcp/dist/index.js"]
    }
  }
}
```

**Claude Code**:

```bash
claude mcp add react-native node /absolute/path/to/react-native-devtools-mcp/dist/index.js
```

**Cursor** — add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "react-native": {
      "command": "node",
      "args": ["/absolute/path/to/react-native-devtools-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### Observation

| Tool                 | Description                                              | Params                                                                                             |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `screenshot`         | Capture screen as PNG image                              | `name?` (string)                                                                                   |
| `get_view_hierarchy` | Dump UI accessibility tree with labels, types, bounds    | `format?` (raw\|tree), `filter?` (string)                                                          |
| `get_device_info`    | Device/simulator info and connection status              | none                                                                                               |
| `get_device_logs`    | Device-level console logs (simctl log / adb logcat)      | `duration?` (seconds, default 30), `filter?` (regex)                                               |
| `get_metro_status`   | Metro bundler status and connected RN runtimes           | none                                                                                               |
| `get_js_logs`        | JS console output (console.log/warn/error) via Metro CDP | `duration?` (seconds, default 5), `filter?` (regex), `level?` (all\|log\|warn\|error\|info\|debug) |

### Interaction

| Tool            | Description                                         | Params                                                               |
| --------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| `tap`           | Tap at screen coordinates                           | `x` (number), `y` (number)                                           |
| `type_text`     | Type into focused input field                       | `text` (string)                                                      |
| `press_button`  | Press device button                                 | `button` (home\|back\|enter\|delete)                                 |
| `scroll`        | Scroll in a direction                               | `direction` (up\|down\|left\|right), `amount?` (pixels, default 500) |
| `open_deeplink` | Open URL or deep link in app                        | `url` (string)                                                       |
| `js_eval`       | Execute JavaScript in the running app via Metro CDP | `expression` (string)                                                |

### Utility

| Tool              | Description                                  | Params           |
| ----------------- | -------------------------------------------- | ---------------- |
| `ping`            | Health check — device status                 | none             |
| `start_recording` | Start screen recording                       | `name?` (string) |
| `stop_recording`  | Stop recording, return file path             | none             |
| `help`            | List all tools with params and system status | none             |

## Environment Variables

All optional. The server auto-detects everything.

| Variable               | Description                                 | Default       |
| ---------------------- | ------------------------------------------- | ------------- |
| `DETOX_MCP_PLATFORM`   | Force platform: `ios` or `android`          | auto-detect   |
| `DETOX_MCP_DEVICE_ID`  | Force device UDID (iOS) or serial (Android) | auto-detect   |
| `DETOX_MCP_IDB_PATH`   | Path to `idb` binary for iOS view hierarchy | auto-discover |
| `DETOX_MCP_METRO_PORT` | Metro bundler port                          | `8081`        |
| `DETOX_MCP_METRO_HOST` | Metro bundler host                          | `127.0.0.1`   |

## Use as Library

`react-native-devtools-mcp` is designed to be extended. Import `createServer` to get a pre-configured MCP server with all generic tools, then register your own:

```typescript
import { createServer } from "react-native-devtools-mcp";

const server = createServer({ name: "my-custom-mcp", version: "1.0.0" });

// Add your own tools on top of the 16 built-in ones
server.tool("my_tool", "Does something custom", {}, async () => {
  return { content: [{ type: "text", text: "result" }] };
});
```

Individual register functions are also exported if you want selective tool registration:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerScreenshotTool,
  registerViewHierarchyTool,
  registerInteractionTools,
} from "react-native-devtools-mcp";

const server = new McpServer({ name: "minimal", version: "1.0.0" });
registerScreenshotTool(server);
registerViewHierarchyTool(server);
registerInteractionTools(server);
```

Metro/CDP utilities are exported too: `getMetroTargets`, `getMetroStatus`, `cdpEval`, `captureJsLogs`, `getMetroBaseUrl`.

## How it Works

No app code changes required. The server connects to existing debug interfaces:

- **iOS Simulator**: `xcrun simctl` for screenshots, input, logs, deep links. Facebook IDB (`idb ui describe-all`) for view hierarchy with accessibility labels, frames, and element roles.
- **Android Emulator**: `adb` for screenshots, input, logs, deep links. `uiautomator dump` for view hierarchy with resource-ids (testIDs), text, and bounds.
- **Metro Bundler**: Chrome DevTools Protocol (CDP) over WebSocket for JS console capture (`Runtime.consoleAPICalled`), JS evaluation (`Runtime.evaluate`), and runtime status. Connects to `http://localhost:8081/json` to discover available runtimes.

## Troubleshooting

**"No booted simulator or emulator detected"**
Boot a simulator (`xcrun simctl boot "iPhone 15 Pro"`) or emulator (`emulator -avd <name>`), or set `DETOX_MCP_PLATFORM` and `DETOX_MCP_DEVICE_ID` env vars.

**View hierarchy empty on iOS**
iOS view hierarchy requires Facebook IDB. Install it:

```bash
brew tap facebook/fb && brew install idb-companion
pip3 install fb-idb
```

Verify with: `idb ui describe-all --udid <simulator-udid>`. If `idb` is not on PATH, set `DETOX_MCP_IDB_PATH=/path/to/idb`.

**IDB not found**
The server searches common locations automatically. If it still can't find IDB, set `DETOX_MCP_IDB_PATH` to the absolute path of the `idb` binary (e.g., `~/Library/Python/3.9/bin/idb`).

**Screenshot fails on Android**
Ensure `adb` is on PATH and the emulator is fully booted past the lock screen.

**Metro/JS tools not working**
Ensure Metro bundler is running and accessible. Test with:

```bash
curl http://localhost:8081/json
```

If Metro runs on a different port, set `DETOX_MCP_METRO_PORT`.

**JS eval returns "No React Native runtime found"**
The app must be running and connected to Metro. Check `get_metro_status` to see connected runtimes.

## License

MIT
