import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Without this, Vite only discovers these (large, CJS-ish) deps the first
  // time a lazy route that imports them is actually visited in a dev
  // session — which triggers a "new dependencies optimized" re-bundle AND a
  // full page reload mid-navigation, costing several seconds right when it
  // looks like "this page is just slow". Pre-bundling them up front at dev
  // server startup instead means that cost is paid once, before you ever
  // click into Schedule/Plant Report/Materials (dhtmlx-gantt, xlsx) or any
  // chart (recharts), not on your first visit to each.
  optimizeDeps: {
    include: ["dhtmlx-gantt", "xlsx", "recharts"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
