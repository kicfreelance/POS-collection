import os from "node:os";
import type { NextConfig } from "next";

// In dev mode (npm run dev), a Terminal PC loads this Server's Next dev
// server over the LAN. Next.js blocks cross-origin dev-only requests (HMR,
// /_next/* assets) by default unless the origin is explicitly allowed — so
// without this, a Terminal's window loads blank/broken when pointed at a dev
// server instead of a packaged build. This only matters for `next dev`;
// packaged builds run the standalone production server, which has no such
// restriction.
function localLanAddresses(): string[] {
  const addresses: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const info of iface ?? []) {
      if (info.family === "IPv4" && !info.internal) {
        addresses.push(info.address);
      }
    }
  }
  return addresses;
}

const nextConfig: NextConfig = {
  // Packaged builds bundle a self-contained Node server (no separate `next start`
  // install step, no dev-only files) that Electron's main process spawns directly.
  output: "standalone",
  allowedDevOrigins: localLanAddresses(),
};

export default nextConfig;
