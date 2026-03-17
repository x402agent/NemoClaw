import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/idl/**",
    "!src/index.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "clover"],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
    "./src/bondingCurve.ts": {
      branches: 90,
      functions: 80,
      lines: 90,
      statements: 90,
    },
    "./src/fees.ts": {
      branches: 75,
      functions: 80,
      lines: 75,
      statements: 75,
    },
    "./src/analytics.ts": {
      branches: 50,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    "./src/state.ts": {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    "./src/tokenIncentives.ts": {
      branches: 75,
      functions: 100,
      lines: 85,
      statements: 85,
    },
    "./src/errors.ts": {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  } as Config["coverageThreshold"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
};

export default config;

