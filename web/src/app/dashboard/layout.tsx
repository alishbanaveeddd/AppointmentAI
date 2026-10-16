/**
 * M8 — Dashboard layout.
 *
 * Modern responsive dashboard shell with desktop sidebar, mobile header,
 * and clean container widths.
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Navigation } from '@/components/Navigation';
import { Spinner } from '@/components/ui';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isRestoring } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isRestoring && !user) {
      router.replace('/login');
    }
  }, [user, isRestoring, router]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isRestoring || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Spinner size={24} className="text-indigo-600" />
          <span className="text-sm font-medium">Authenticating session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50/70 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30">
        <Navigation currentPath={pathname} />
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-250 ease-in-out lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Navigation currentPath={pathname} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Mobile Top Header */}
        <header className="lg:hidden sticky top-0 z-20 h-14 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 flex items-center justify-between">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Open navigation menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="font-bold text-slate-900 text-sm">
            Appointment<span className="text-indigo-600">AI</span>
          </div>
          <div className="w-6" /> {/* spacer for balance */}
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
