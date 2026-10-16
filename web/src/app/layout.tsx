/**
 * M8 — Root layout.
 *
 * Wraps every page in the AuthProvider so that authentication state
 * is available throughout the application.
 */
import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'Appointment AI — Intelligent Scheduling Assistant',
  description: 'AI-assisted appointment booking with real-time slot extraction, conflict-free scheduling, and structured proposals.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
