import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "MC EHR — Patient Records",
  description: "Practitioner-facing electronic health record built on FHIR.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/patients" className="flex items-center gap-2 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
                ✚
              </span>
              <span className="text-lg tracking-tight">MC EHR</span>
            </Link>
            <nav className="text-sm text-muted">
              <Link href="/patients" className="rounded px-2 py-1 hover:text-foreground">
                Patients
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted sm:px-6">
            FHIR coding challenge · Practitioner-facing EHR
          </div>
        </footer>
      </body>
    </html>
  );
}
