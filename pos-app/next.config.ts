import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Packaged builds bundle a self-contained Node server (no separate `next start`
  // install step, no dev-only files) that Electron's main process spawns directly.
  output: "standalone",
};

export default nextConfig;
