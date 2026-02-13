export default {
  test: {
    globals: true,
    environment: "node",
    testTimeout: 60000, // 60 second timeout for e2e tests
    include: ["tests/e2e/**/*.test.ts"],
    setupFiles: [],
  },
};
