import { defineConfig } from "vite";
    import react from "@vitejs/plugin-react-swc";
    import path from "path";

    export default defineConfig(() => ({
      base: "./", // Mengganti dengan base path relatif untuk Capacitor
      server: {
        host: "::",
        port: 8080,
      },
      plugins: [react()],
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
        },
      },
      optimizeDeps: {
        exclude: ["adhan"], // Mengecualikan adhan dari optimasi dependensi Vite
      },
    }));