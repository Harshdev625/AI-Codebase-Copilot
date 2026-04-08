import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";

import { ThemeProvider } from "@/components/shared/theme-provider";
import { ToastProvider } from "@/components/shared/toast-provider";
import "@/styles/globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "AI Codebase Copilot",
  description: "Modern AI workspace for repository intelligence and code conversations",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${plexMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
