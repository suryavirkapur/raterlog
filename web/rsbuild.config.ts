import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

// The production build is embedded into the Rust binary (see api/src/web.rs),
// so the app and the API share one origin. In dev, proxy API calls to the
// Rust server on :8080.
const API = process.env.API_URL || "http://localhost:8080";

export default defineConfig({
  plugins: [pluginReact()],
  source: { entry: { index: "./src/index.tsx" } },
  resolve: { alias: { "@": "./src" } },
  html: {
    title: "Raterlog — Real-time event tracking",
    favicon: "./public/icon.png",
    tags: [
      { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" } },
      { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" } },
      {
        tag: "link",
        attrs: {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Geist:wght@300..600&family=Geist+Mono:wght@400;500&display=swap",
        },
      },
    ],
    meta: {
      description:
        "Track the events that matter in your product. Real-time feed, push notifications, charts, funnels and user journeys.",
    },
  },
  server: {
    port: 3000,
    historyApiFallback: true,
    proxy: { "/api": API, "/v1": API, "/log": API, "/health": API },
  },
  output: { distPath: { root: "dist" } },
});
