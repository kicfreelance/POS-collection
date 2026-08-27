import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { app } from "electron";

/**
 * Stable per-Terminal id, created once and kept in the app's userData dir. Sent
 * to the Server so it can count this screen against the licence seat limit.
 */
export function terminalMachineId(): string {
  const file = path.join(app.getPath("userData"), "terminal-id");
  try {
    const v = fs.readFileSync(file, "utf8").trim();
    if (v) return v;
  } catch {
    /* create below */
  }
  const id = crypto.randomUUID();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, id, { flag: "wx" });
    return id;
  } catch {
    try {
      return fs.readFileSync(file, "utf8").trim() || id;
    } catch {
      return id;
    }
  }
}
