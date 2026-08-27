import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

export type NodeRole = "server" | "terminal";

export interface NodeConfig {
  role: NodeRole;
  serverHost?: string;
  serverPort?: number;
}

function configPath(): string {
  return path.join(app.getPath("userData"), "node-config.json");
}

export function loadNodeConfig(): NodeConfig | null {
  try {
    const raw = fs.readFileSync(configPath(), "utf-8");
    const parsed = JSON.parse(raw) as NodeConfig;
    if (parsed.role !== "server" && parsed.role !== "terminal") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveNodeConfig(config: NodeConfig): void {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf-8");
}
