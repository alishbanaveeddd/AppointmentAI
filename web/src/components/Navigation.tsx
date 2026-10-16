/**
 * M8 — Navigation component for the dashboard.
 *
 * Modern SaaS sidebar with active route highlights, user profile badge,
 * and quick-action shortcuts.
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

interface NavItem {
  label: string;
  href: string;
  badge?: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'Overview',
    href: '/dashboard',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'AI Assistant',
    href: '/dashboard/chat',
    badge: 'Groq',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    label: 'Appointments',
    href: '/dashboard/appointments',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Doctors',
    href: '/dashboard/doctors',
    badge: '4 Active',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export function Navigation({
  currentPath,
}: {
  currentPath: string;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <nav className="flex h-full flex-col bg-white border-r border-slate-200/90 shadow-xs">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl gradient-bg flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-slate-900 tracking-tight text-base leading-tight">
              Appointment<span className="text-indigo-600">AI</span>
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              API Connected
            </span>
          </div>
        </Link>
      </div>

      {/* Nav Links */}
      <div className="flex-1 px-3 py-4 space-y-1">
        <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </div>

        {navItems.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Quick Launch Button */}
        <div className="pt-4 px-2">
          <Link
            href="/dashboard/chat"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
          >
            <span>✨</span>
            <span>New AI Booking</span>
          </Link>
        </div>
      </div>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div className="h-9 w-9 rounded-xl gradient-bg flex items-center justify-center text-white text-sm font-bold shadow-xs">
              {userInitial}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {user?.name ?? 'User'}
            </p>
            <p className="text-[11px] text-slate-500 truncate" title={user?.email}>
              {user?.email}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </nav>
  );
}
