import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  title: "AI Codebase Copilot",
  description: "Production-grade agentic RAG copilot for code repositories"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

