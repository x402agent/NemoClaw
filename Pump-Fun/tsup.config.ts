import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs"],
    outDir: "dist",
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    outDir: "dist/esm",
    dts: true,
    clean: false,
    sourcemap: true,
    splitting: false,
  },
]);

