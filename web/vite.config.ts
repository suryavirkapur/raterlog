import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";
import viteReact from "@vitejs/plugin-react";

// oslo/password loads native @node-rs/argon2 (+ bcrypt) addons; these must never
// be pre-bundled or bundled — they are required at runtime on the server only.
const nativeServerDeps = ["@node-rs/argon2", "@node-rs/bcrypt"];

export default defineConfig({
  server: {
    port: 3000,
    host: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    exclude: nativeServerDeps,
  },
  ssr: {
    external: [...nativeServerDeps, "oslo"],
  },
  plugins: [
    tanstackStart(),
    nitroV2Plugin({ preset: "node-server" }),
    // React's plugin must come after the TanStack Start plugin.
    viteReact(),
  ],
});
