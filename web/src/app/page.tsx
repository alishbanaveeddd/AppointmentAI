/**
 * M8 — Landing page.
 *
 * Modern high-converting SaaS landing experience with interactive demo highlights,
 * feature showcases, and one-click evaluator credentials.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';

export default function HomePage() {
  const { user, isRestoring } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isRestoring && user) {
      router.replace('/dashboard');
    }
  }, [user, isRestoring, router]);

  if (isRestoring) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Spinner size={24} className="text-indigo-600" />
          <span className="text-sm font-medium">Loading Appointment AI…</span>
        </div>
      </div>
    );
  }

  if (user) {
    return null; // redirecting
  }

  return (
    <div className="min-h-screen mesh-gradient-bg flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl gradient-bg flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 tracking-tight text-base leading-tight">
                Appointment<span className="text-indigo-600">AI</span>
              </span>
              <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
                Intelligent Booking
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white gradient-bg hover:opacity-95 px-4 py-2 rounded-xl shadow-xs hover:shadow transition-all"
            >
              Get Started
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 flex flex-col items-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold mb-6 shadow-xs animate-float">
          <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-ping"></span>
          <span>Powered by Groq LLM & PostgreSQL Concurrency Guard</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 text-center tracking-tight max-w-4xl leading-[1.15] mb-6">
          Smarter scheduling through{' '}
          <span className="gradient-text">conversational AI</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 text-center max-w-2xl mb-8 leading-relaxed">
          Book appointments natural-dialogue style. Our AI extracts slots in real time, generates formal proposals, and eliminates double-bookings with database-level isolation.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-bg text-white font-semibold text-base shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            Start Booking Free
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-base shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            Sign In with Demo Account
          </Link>
        </div>

        {/* Evaluator Quick Demo Box */}
        <div className="w-full max-w-xl glass-card rounded-2xl p-4 sm:p-5 mb-14 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center shrink-0 font-mono text-sm font-bold">
              👤
            </div>
            <div className="text-left text-xs sm:text-sm">
              <span className="font-semibold text-slate-900 block">Reviewer Demo Credentials:</span>
              <span className="font-mono text-slate-500">demo@example.com</span> / <span className="font-mono text-slate-500">Demo@12345</span>
            </div>
          </div>
          <Link
            href="/login"
            className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-lg transition-colors"
          >
            Auto-fill Login →
          </Link>
        </div>

        {/* Visual Product Showcase / Mockup */}
        <div className="w-full max-w-4xl glass-card rounded-3xl p-3 sm:p-6 shadow-xl border border-slate-200/90 mb-16">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 px-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-400"></span>
              <span className="w-3 h-3 rounded-full bg-amber-400"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
              <span className="ml-2 text-xs font-mono text-slate-400">appointment-ai-assistant</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              AI Online (Groq)
            </span>
          </div>

          <div className="space-y-4 text-xs sm:text-sm">
            {/* User Message */}
            <div className="flex justify-end">
              <div className="max-w-md rounded-2xl rounded-tr-xs gradient-bg text-white px-4 py-2.5 shadow-xs">
                Hi! I need to book a general consultation for next Monday morning at 10 AM.
              </div>
            </div>

            {/* Assistant Response with Proposal */}
            <div className="flex justify-start gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold text-xs">
                AI
              </div>
              <div className="max-w-lg space-y-3">
                <div className="bg-slate-100/80 rounded-2xl rounded-tl-xs px-4 py-2.5 text-slate-800">
                  I found an open 30-minute slot! Here is your booking proposal. Please confirm:
                </div>

                {/* Rendered Mock Proposal Card */}
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      Booking Proposal
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">ID: prop_9f2a7c...</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3 text-slate-700">
                    <div><span className="font-semibold">Service:</span> General Consultation</div>
                    <div><span className="font-semibold">Duration:</span> 30 Minutes</div>
                    <div><span className="font-semibold">Time:</span> Mon, 10:00 AM - 10:30 AM</div>
                    <div><span className="font-semibold">Timezone:</span> Asia/Karachi (PKT)</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium text-xs shadow-xs">
                      ✓ Confirm Booking
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium text-xs">
                      Edit details
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="w-full grid sm:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 glass-card-hover border border-slate-200/80">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Conversational Intelligence</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Powered by Groq LLM adapters. Extracts dates, times, and service categories from plain English sentences without manual forms.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 glass-card-hover border border-slate-200/80">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Zero-Conflict Calendar</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Engineered with PostgreSQL exclusion constraints (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">btree_gist</code>) to physically prevent double-bookings under concurrent requests.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 glass-card-hover border border-slate-200/80">
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Explicit Proposal Safeguards</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              AI creates transient proposals; appointments are never committed without user confirmation and adhere to a 2-hour cancellation cutoff policy.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Appointment AI • Senior Full-Stack Assessment Prototype</span>
          <div className="flex items-center gap-4">
            <Link href="/api/health" target="_blank" className="hover:text-indigo-600 transition-colors">
              API Health ↗
            </Link>
            <Link href="/login" className="hover:text-indigo-600 transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-indigo-600 transition-colors">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
