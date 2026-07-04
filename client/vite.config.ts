import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const clientRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: clientRoot,
  base: process.env.GITHUB_PAGES === "true" ? "/resume-agent/" : "/",
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3003"
    }
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true
  }
});
