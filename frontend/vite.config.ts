/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const DEFAULT_API_TARGET = "http://localhost:8000";

// The production build is written into the backend so a single App Service app serves both.
export default defineConfig(({ mode }) => {
  // Where `npm run dev` forwards /api. Set API_PROXY_TARGET (shell or frontend/.env.local) when the backend is not on
  // port 8000.
  const apiTarget = loadEnv(mode, process.cwd(), "").API_PROXY_TARGET || DEFAULT_API_TARGET;
  return {
    plugins: [react()],
    build: { outDir: "../backend/app/static", emptyOutDir: true, sourcemap: false },
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          // Vite rewrites Host to the backend's own address. The backend's same-origin check on admin sign-in compares
          // the browser's Origin with the Host it receives, so hand it the Host the browser used.
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, request) => {
              if (request.headers.host) proxyReq.setHeader("host", request.headers.host);
            });
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
