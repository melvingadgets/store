import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5000,
  },
  resolve: {

  },
  build: {
    chunkSizeWarningLimit: 1000, // Increase the limit to 1000 kB
    // outDir: 'build',
  },



});
