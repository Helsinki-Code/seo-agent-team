import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Space_Grotesk } from "next/font/google";
import { SiteNav } from "../components/site-nav";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space"
});

export const metadata: Metadata = {
  title: "SEO Command Center",
  description: "Autonomous AI SEO operations dashboard"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.variable}>
        <ClerkProvider>
          <ThemeProvider>
            <SiteNav />
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
