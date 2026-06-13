import { defineConfig } from "vitest/config";

const integrationProject = (env = {}) => ({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/integration/setup.ts"],
    env: {
      AWS_REGION: "us-east-1",
      TURBINE_TEST_TABLE: "turbine-integration-tests",
      ...env,
    },
  },
});

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          coverage: { enabled: true },
        },
      },
      {
        test: {
          name: "integration",
          ...integrationProject().test,
        },
      },
      {
        test: {
          name: "integration-localstack",
          ...integrationProject({
            AWS_ENDPOINT_URL: "http://localhost:4566",
            AWS_ACCESS_KEY_ID: "test",
            AWS_SECRET_ACCESS_KEY: "test",
          }).test,
        },
      },
    ],
  },
});
