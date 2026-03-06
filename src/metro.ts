import http from "node:http";
import WebSocket from "ws";

const METRO_PORT = parseInt(
  process.env["RN_DEVTOOLS_METRO_PORT"] ?? "8081",
  10,
);
const METRO_HOST = process.env["RN_DEVTOOLS_METRO_HOST"] ?? "127.0.0.1";
const CDP_TIMEOUT_MS = 5_000;

type CdpTarget = {
  id: string;
  title: string;
  description: string;
  type: string;
  devtoolsFrontendUrl: string;
  webSocketDebuggerUrl: string;
};

type CdpResponse = {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

export function getMetroBaseUrl(): string {
  return `http://${METRO_HOST}:${METRO_PORT}`;
}

export async function getMetroTargets(): Promise<CdpTarget[]> {
  const url = `${getMetroBaseUrl()}/json`;

  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: CDP_TIMEOUT_MS }, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data) as CdpTarget[]);
        } catch {
          reject(
            new Error(`Invalid JSON from Metro /json: ${data.slice(0, 200)}`),
          );
        }
      });
    });

    req.on("error", (err: Error) =>
      reject(new Error(`Cannot reach Metro at ${url}: ${err.message}`)),
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Metro at ${url} timed out after ${CDP_TIMEOUT_MS}ms`));
    });
  });
}

export async function getMetroStatus(): Promise<string> {
  const url = `${getMetroBaseUrl()}/status`;

  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: CDP_TIMEOUT_MS }, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => resolve(data));
    });

    req.on("error", (err: Error) =>
      reject(new Error(`Cannot reach Metro at ${url}: ${err.message}`)),
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Metro status timed out after ${CDP_TIMEOUT_MS}ms`));
    });
  });
}

function pickBestTarget(targets: CdpTarget[]): CdpTarget | null {
  const rnTarget = targets.find(
    (t) =>
      t.title.includes("React") ||
      t.title.includes("Hermes") ||
      t.description.includes("React Native"),
  );
  return rnTarget ?? targets[0] ?? null;
}

export async function cdpEval(expression: string): Promise<unknown> {
  const targets = await getMetroTargets();
  const target = pickBestTarget(targets);
  if (!target) {
    throw new Error(
      "No React Native runtime found. Is the app running with Metro?",
    );
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const msgId = 1;
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error(`CDP eval timed out after ${CDP_TIMEOUT_MS}ms`));
      }
    }, CDP_TIMEOUT_MS);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          id: msgId,
          method: "Runtime.evaluate",
          params: {
            expression,
            returnByValue: true,
            awaitPromise: true,
          },
        }),
      );
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      if (settled) return;
      const msg = JSON.parse(raw.toString()) as CdpResponse;
      if (msg.id !== msgId) return;

      settled = true;
      clearTimeout(timeout);
      ws.close();

      if (msg.error) {
        reject(new Error(`CDP error: ${msg.error.message}`));
        return;
      }

      const result = msg.result?.["result"] as
        | {
            type: string;
            value?: unknown;
            description?: string;
            subtype?: string;
          }
        | undefined;

      if (!result) {
        resolve(undefined);
        return;
      }

      if (result.subtype === "error") {
        reject(new Error(`JS error: ${result.description ?? "unknown"}`));
        return;
      }

      resolve(result.value ?? result.description ?? `[${result.type}]`);
    });

    ws.on("error", (err: Error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`CDP WebSocket error: ${err.message}`));
      }
    });
  });
}

type ConsoleEntry = {
  timestamp: number;
  level: string;
  text: string;
};

export async function captureJsLogs(
  durationMs: number,
): Promise<ConsoleEntry[]> {
  const targets = await getMetroTargets();
  const target = pickBestTarget(targets);
  if (!target) {
    throw new Error(
      "No React Native runtime found. Is the app running with Metro?",
    );
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const logs: ConsoleEntry[] = [];
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      ws.close();
      resolve(logs);
    };

    const timeout = setTimeout(finish, durationMs);

    ws.on("open", () => {
      ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
      ws.send(JSON.stringify({ id: 2, method: "Log.enable" }));
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      if (settled) return;
      const msg = JSON.parse(raw.toString()) as {
        method?: string;
        params?: Record<string, unknown>;
      };

      if (msg.method === "Runtime.consoleAPICalled") {
        const params = msg.params as {
          type: string;
          timestamp: number;
          args: Array<{ type: string; value?: unknown; description?: string }>;
        };
        const text = params.args
          .map((a) => a.value ?? a.description ?? `[${a.type}]`)
          .join(" ");
        logs.push({
          timestamp: params.timestamp,
          level: params.type,
          text,
        });
      }

      if (msg.method === "Log.entryAdded") {
        const entry = (
          msg.params as {
            entry: { level: string; text: string; timestamp: number };
          }
        ).entry;
        logs.push({
          timestamp: entry.timestamp,
          level: entry.level,
          text: entry.text,
        });
      }
    });

    ws.on("error", (err: Error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`CDP WebSocket error: ${err.message}`));
      }
    });
  });
}
