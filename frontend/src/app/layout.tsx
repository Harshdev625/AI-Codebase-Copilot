import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";

const themeInitScript = `(() => {
  try {
    const key = "aicc_theme_mode";
    const stored = localStorage.getItem(key);
    const mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const resolved = mode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (_) {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
  }
})();`;

export const metadata: Metadata = {
  title: "AI Codebase Copilot",
  description: "Production-grade agentic RAG copilot for code repositories"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

