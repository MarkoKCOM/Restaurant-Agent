import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: "src/main.tsx",
      name: "SableBooking",
      fileName: "sable-booking",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    "process.env.WIDGET_API_URL": JSON.stringify(
      process.env.WIDGET_API_URL || "http://localhost:3001",
    ),
  },
});
