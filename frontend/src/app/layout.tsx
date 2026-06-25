import type { Metadata } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";

import { AppProviders } from "@/components/app-providers";
import { CommandPalette } from "@/components/command-palette";
import { OnboardingWalkthrough } from "@/features/onboarding/components/onboarding-walkthrough";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "AI Codebase Copilot",
  description: "Modern AI studio for repository intelligence and code conversations",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <AppProviders>
          {children}
          <CommandPalette />
          <OnboardingWalkthrough />
        </AppProviders>
      </body>
    </html>
  );
}
