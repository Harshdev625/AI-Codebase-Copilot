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
    "src/features/explorer/components/lazy-tree-node.tsx",
    "!src/features/repositories/components/**",
    "!src/features/repositories/hooks/**",
    "!src/features/repositories/services/**",
    "!src/features/chat/components/context-panel.tsx",
    "!src/features/chat/hooks/use-context-entries.ts",
    "!src/features/chat/services/context-entry-service.ts",
    "!src/features/studio/panels/**",
    "!src/features/studio/workbench/**",
    "src/features/studio/workbench/search-line-range.ts",
    "src/features/studio/workbench/monaco-line-highlight.ts",
    "src/features/studio/workbench/welcome-tab.tsx",
    "src/features/studio/context/studio-workbench-context.tsx",
    "!src/features/studio/components/studio-v2-shell.tsx",
    "!src/features/studio/components/studio-session-sidebar.tsx",
    "!src/features/studio/components/studio-explorer-panel.tsx",
    "!src/features/studio/components/studio-primary-sidebar.tsx",
    "!src/features/studio/components/global-top-bar.tsx",
    "!src/features/studio/components/copilot-studio-shell.tsx",
    "!src/features/dashboard/components/dashboard-add-repository.tsx",
    "!src/components/layout/app-shell.tsx",
    "!src/components/layout/page-transition.tsx",
    "!src/components/command-palette.tsx",
    "!src/components/app-providers.tsx",
    "!src/app/api/v1/**"
  ],
  coverageThreshold: {
    global: {
      branches: 47,
      functions: 57,
      lines: 65,
      statements: 63
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
