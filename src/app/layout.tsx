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
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/patients" className="flex items-center gap-2 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
                ✚
              </span>
              <span className="text-lg tracking-tight">MC EHR</span>
            </Link>
            <nav className="flex items-center gap-1.5 text-sm sm:gap-2">
              <Link
                href="/patients"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-muted transition hover:bg-background hover:text-foreground"
              >
                <RosterIcon />
                <span className="hidden sm:inline">Patients</span>
              </Link>
              <Link
                href="/patients/new"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 font-medium transition hover:bg-background"
              >
                <NewPatientIcon />
                <span className="hidden sm:inline">New patient</span>
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-border bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted sm:px-6">
            FHIR coding challenge · Practitioner-facing EHR
          </div>
        </footer>
      </body>
    </html>
  );
}

/** Roster / "back to patient list" icon (two people). */
function RosterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** New patient icon (person with a plus). */
function NewPatientIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}
