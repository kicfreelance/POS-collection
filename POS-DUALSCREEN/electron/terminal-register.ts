import os from "node:os";
import { app, dialog } from "electron";
import { terminalMachineId } from "./terminal-id";

const INTERVAL_MS = 60_000;

/**
 * Terminal role: register this machine with the Server every minute so the
 * Server can enforce the licence seat limit locally (Terminals never contact
 * the licence server themselves).
 *
 * On HTTP 403 (seat limit reached) it shows a blocking notice and quits. A
 * Server that is simply unreachable, or hasn't got the /api/terminal/register
 * route yet, is ignored and retried on the next tick.
 */
export function startTerminalRegistration(serverHost: string, serverPort: number): () => void {
  const base = `http://${serverHost}:${serverPort}`;
  const machineId = terminalMachineId();
  let stopped = false;

  const ping = async (): Promise<void> => {
    if (stopped) return;
    try {
      const res = await fetch(`${base}/api/terminal/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ machineId, hostname: os.hostname() }),
      });
      if (res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as {
          active?: number;
          seatLimit?: number;
          error?: string;
        };
        stopped = true;
        await dialog.showMessageBox({
          type: "error",
          buttons: ["Quit"],
          noLink: true,
          message:
            body.error === "server_unlicensed"
              ? "The Server is not licensed"
              : "Licence seat limit reached",
          detail:
            body.error === "server_unlicensed"
              ? "The Server PC has no valid licence. Activate it there first."
              : `This Dual-Screen licence allows ${body.seatLimit ?? "?"} screens and ` +
                `${body.active ?? "?"} are already in use.\n\n` +
                "Close POS on another Terminal, or ask your vendor to raise the seat count.",
        });
        app.exit(0);
      }
    } catch {
      /* server not reachable yet — retry next tick */
    }
  };

  void ping();
  const timer = setInterval(() => void ping(), INTERVAL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
