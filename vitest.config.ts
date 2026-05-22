import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  // tsconfig.json sets `jsx: "preserve"` for Next.js, so Vite (via oxc)
  // refuses to transform JSX in .tsx files imported from tests. Force
  // the JSX runtime here so tests can pull pure helpers (e.g.
  // `coreReducer`) out of files that also contain JSX components.
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
  },
});
