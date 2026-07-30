import { defineConfig } from "vite";
import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";

// BUILD_TARGET=lib  → publishable Vue component library at dist/lib/
// (default)         → SPA demo app at dist/
const isLib = process.env.BUILD_TARGET === "lib";

export default defineConfig({
  plugins: [vue(), tailwindcss(), ...(isLib ? [dts({ bundleTypes: true, tsconfigPath: "./tsconfig.app.json", outDirs: "dist/lib" })] : [])],
  build: isLib
    ? {
        outDir: "dist/lib",
        lib: {
          entry: resolve(import.meta.dirname, "src/index.ts"),
          name: "MulmocastDeckWeb",
          formats: ["es"],
          fileName: () => "index.js",
        },
        rollupOptions: {
          // Don't bundle peer deps — consumers provide them.
          external: ["vue", "@mulmocast/deck"],
          output: { globals: { vue: "Vue" } },
        },
      }
    : undefined,
});
