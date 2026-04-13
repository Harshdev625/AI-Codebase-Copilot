"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
      themes={["dark"]}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
