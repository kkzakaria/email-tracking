import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navigation } from "@/components/layout/navigation";
import { ThemeProvider } from "@/components/theme-provider";
import { WebhookStatusProvider } from "@/contexts/webhook-status-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Email Tracking - Suivi d'emails professionnels",
  description: "Application de suivi d'emails avec Microsoft 365 - Tracking, rappels automatiques et analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <WebhookStatusProvider>
            <Navigation />
            <main className="pt-12">
              {children}
            </main>
          </WebhookStatusProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
