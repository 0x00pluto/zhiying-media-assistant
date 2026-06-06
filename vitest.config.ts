import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "~features": path.resolve(__dirname, "src/features"),
      "~shared": path.resolve(__dirname, "src/shared"),
      "~contents": path.resolve(__dirname, "src/contents"),
      "~background": path.resolve(__dirname, "src/background"),
      "~sidepanel": path.resolve(__dirname, "src/sidepanel"),
      "~tabs": path.resolve(__dirname, "src/tabs"),
      "~assets": path.resolve(__dirname, "src/assets")
    }
  }
})
