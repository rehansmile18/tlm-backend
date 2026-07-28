import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    // Each test file that calls setupTestContext() spawns its own real mongod process
    // (mongodb-memory-server). Capping concurrency avoids the resource contention that produced
    // intermittent request failures under full parallelism in the sibling tlm-punch-processor repo.
    maxWorkers: 4,
  },
});
