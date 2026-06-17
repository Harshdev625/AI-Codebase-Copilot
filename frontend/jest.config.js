const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./"
});

const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  collectCoverageFrom: [
    "src/app/api/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}",
    "src/lib/**/*.{ts,tsx}",
    "src/features/**/*.{ts,tsx}",
    "src/store/**/*.{ts,tsx}",
    "src/core/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/src/app/layout.tsx",
    "!src/components/ui/**/*.{ts,tsx}",
    "!src/features/explorer/**",
    "!src/features/repositories/components/**",
    "!src/features/repositories/hooks/**",
    "!src/features/repositories/services/**",
    "!src/features/chat/components/context-panel.tsx",
    "!src/features/chat/hooks/use-context-entries.ts",
    "!src/features/chat/services/context-entry-service.ts",
    "!src/features/dashboard/components/dashboard-add-repository.tsx",
    "!src/components/layout/app-shell.tsx",
    "!src/components/layout/page-transition.tsx",
    "!src/components/command-palette.tsx",
    "!src/components/app-providers.tsx",
    "!src/app/api/v1/**"
  ],
  coverageThreshold: {
    global: {
      branches: 54,
      functions: 63,
      lines: 73,
      statements: 72
    }
  },
  moduleNameMapper: {
    "^react-syntax-highlighter(.*)$": "<rootDir>/tests/__mocks__/react-syntax-highlighter.tsx",
    "^react-diff-viewer-continued$": "<rootDir>/tests/__mocks__/react-diff-viewer-continued.tsx",
    "^react-markdown$": "<rootDir>/tests/__mocks__/react-markdown.tsx",
    "^remark-gfm$": "<rootDir>/tests/__mocks__/remark-gfm.ts",
    "^uuid$": "<rootDir>/tests/__mocks__/uuid.ts",
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  testMatch: ["**/*.test.ts", "**/*.test.tsx"]
};

module.exports = createJestConfig(customJestConfig);
