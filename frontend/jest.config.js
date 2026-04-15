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
    "^@/app/page$": "<rootDir>/src/testing-compat/pages/home-page.tsx",
    "^@/app/chat/page$": "<rootDir>/src/testing-compat/pages/chat-page.tsx",
    "^@/app/login/page$": "<rootDir>/src/testing-compat/pages/login-page.tsx",
    "^@/app/register/page$": "<rootDir>/src/testing-compat/pages/register-page.tsx",
    "^@/app/dashboard/page$": "<rootDir>/src/testing-compat/pages/dashboard-page.tsx",
    "^@/app/repositories/page$": "<rootDir>/src/testing-compat/pages/repositories-page.tsx",
    "^@/app/admin/page$": "<rootDir>/src/testing-compat/pages/admin-page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/page$": "<rootDir>/src/testing-compat/pages/home-page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/chat\\/page$": "<rootDir>/src/testing-compat/pages/chat-page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/login\\/page$": "<rootDir>/src/testing-compat/pages/login-page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/register\\/page$": "<rootDir>/src/testing-compat/pages/register-page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/dashboard\\/page$": "<rootDir>/src/testing-compat/pages/dashboard-page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/repositories\\/page$": "<rootDir>/src/testing-compat/pages/repositories-page.tsx",
    "^\\.\\.\\/\\.\\.\\/src\\/app\\/admin\\/page$": "<rootDir>/src/testing-compat/pages/admin-page.tsx",
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  testMatch: ["**/*.test.ts", "**/*.test.tsx"]
};

module.exports = createJestConfig(customJestConfig);
