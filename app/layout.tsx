import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextAuthSessionProvider } from "@/components/providers/session-provider";
import { Navigation } from "@/components/layout/navigation";
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
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextAuthSessionProvider>
          <Navigation />
          {children}
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
