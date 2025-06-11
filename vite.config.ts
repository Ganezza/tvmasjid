import { defineConfig } from "vite";
    import react from "@vitejs/plugin-react-swc";
    import path from "path";

    export default defineConfig(() => ({
      base: "/masjid/", // Mengganti dengan nama repositori yang benar
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