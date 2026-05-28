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
    "!**/*.d.ts",
    "!**/src/app/layout.tsx"
  ],
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
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  testMatch: ["**/*.test.ts", "**/*.test.tsx"]
};

module.exports = createJestConfig(customJestConfig);
