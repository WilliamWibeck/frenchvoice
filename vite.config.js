import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev`, Vite serves the frontend on :5173 and proxies
// /api/* to a small local server on :3001 (api-dev-server.js) that runs
// the exact same handlers Vercel deploys as serverless functions.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  preview: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
