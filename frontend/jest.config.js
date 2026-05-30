const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./"
});

const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  collectCoverageFrom: [
    "src/app/api/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}",
    "src/lib/**/*.{ts,tsx}",
    "src/features/**/*.{ts,tsx}",
    "src/store/**/*.{ts,tsx}",
    "src/core/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/src/app/layout.tsx",
    "!src/components/ui/**/*.{ts,tsx}"
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    "^@/app/page$": "<rootDir>/src/app/page.tsx",
    "^@/app/chat/page$": "<rootDir>/src/app/(user)/chat/page.tsx",
    "^@/app/login/page$": "<rootDir>/src/app/(auth)/login/page.tsx",
    "^@/app/register/page$": "<rootDir>/src/app/(auth)/register/page.tsx",
    "^@/app/dashboard/page$": "<rootDir>/src/app/(user)/dashboard/page.tsx",
    "^@/app/repositories/page$": "<rootDir>/src/app/(user)/repositories/page.tsx",
    "^@/app/admin/page$": "<rootDir>/src/app/admin/page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/page$": "<rootDir>/src/app/page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/chat\\/page$": "<rootDir>/src/app/(user)/chat/page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/login\\/page$": "<rootDir>/src/app/(auth)/login/page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/register\\/page$": "<rootDir>/src/app/(auth)/register/page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/dashboard\\/page$": "<rootDir>/src/app/(user)/dashboard/page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/repositories\\/page$": "<rootDir>/src/app/(user)/repositories/page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/admin\\/page$": "<rootDir>/src/app/admin/page.tsx",
    "^@/components/sidebar$": "<rootDir>/src/components/layout/sidebar.tsx",
    "^@/components/chat-shell$": "<rootDir>/src/features/chat/components/chat-workspace.tsx",
    "^react-syntax-highlighter(.*)$": "<rootDir>/tests/__mocks__/react-syntax-highlighter.tsx",
    "^react-markdown$": "<rootDir>/tests/__mocks__/react-markdown.tsx",
    "^remark-gfm$": "<rootDir>/tests/__mocks__/remark-gfm.ts",
    "^uuid$": require.resolve("uuid"),
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  testMatch: ["**/*.test.ts", "**/*.test.tsx"]
};

module.exports = createJestConfig(customJestConfig);
