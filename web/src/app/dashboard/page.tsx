/**
 * M8 — Dashboard overview page.
 *
 * Modern overview with metric stat cards, upcoming appointments spotlight,
 * and quick-action shortcuts.
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { Appointment } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';
import { formatDateTime } from '@/lib/date';
import { AVAILABLE_DOCTORS } from '@/lib/doctors';

export default function DashboardPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointmentsCount, setAllAppointmentsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.listAppointments();
      setAllAppointmentsCount(res.appointments.length);
      // Filter: confirmed, future appointments, sorted by start time
      const upcoming = res.appointments
        .filter(
          (a) =>
            a.status === 'confirmed' &&
            new Date(a.startsAt).getTime() > Date.now(),
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )
        .slice(0, 3);
      setAppointments(upcoming);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not load appointments.');
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="space-y-8">
      {/* Welcome Hero Banner */}
      <div className="rounded-3xl gradient-bg p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white/90 text-xs font-semibold backdrop-blur-xs mb-3">
            ✨ AI-Powered Scheduling Hub
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Welcome back, {user?.name?.split(' ')[0] ?? 'there'}!
          </h1>
          <p className="text-sm sm:text-base text-indigo-100 mb-6 leading-relaxed">
            Need to schedule a new appointment or review your calendar? Your AI assistant is ready to help you book in natural language.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/chat"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-semibold text-sm shadow-xs hover:bg-indigo-50 active:scale-95 transition-all"
            >
              <span>💬</span>
              <span>Open AI Chat Assistant</span>
            </Link>
            <Link
              href="/dashboard/appointments"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-500/40 hover:bg-indigo-500/60 text-white text-sm font-medium backdrop-blur-xs transition-colors"
            >
              <span>View All ({allAppointmentsCount})</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Stat 1 */}
        <div className="glass-card rounded-2xl p-5 border border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Upcoming Bookings
            </span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mb-1">
            {appointments.length}
          </div>
          <p className="text-xs text-slate-500">
            {appointments.length > 0 ? 'Confirmed in system' : 'No upcoming bookings'}
          </p>
        </div>

        {/* Stat 2 */}
        <div className="glass-card rounded-2xl p-5 border border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              AI Engine Status
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
            <span>Groq LLaMA 3.3</span>
          </div>
          <p className="text-xs text-emerald-600 font-medium">
            Active • Fast Structured JSON
          </p>
        </div>

        {/* Stat 3 */}
        <div className="glass-card rounded-2xl p-5 border border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Scheduling Policy
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-base font-bold text-slate-900 mb-1">
            Mon–Fri 9am–5pm
          </div>
          <p className="text-xs text-slate-500">
            Asia/Karachi • 30-min slots
          </p>
        </div>
      </div>

      {/* Main Section: Next Up Spotlight + Upcoming List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Next Confirmed Appointments
          </h2>
          <Link
            href="/dashboard/appointments"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View all appointments →
          </Link>
        </div>

        {isLoading ? (
          <div className="glass-card rounded-2xl p-8 flex items-center justify-center gap-3 text-slate-500">
            <Spinner size={20} className="text-indigo-600" />
            <span className="text-sm">Loading upcoming schedule…</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={loadAppointments}
              className="text-xs font-semibold text-rose-800 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="glass-card rounded-3xl p-8 text-center border border-slate-200/80">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center text-xl mb-3">
              📅
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">No upcoming appointments</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-5">
              You haven't scheduled any appointments yet. Chat with our assistant to reserve your spot!
            </p>
            <Link
              href="/dashboard/chat"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white text-xs font-semibold shadow-xs hover:shadow transition-all"
            >
              <span>✨</span>
              <span>Book with AI Assistant</span>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-200/80 hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                        {apt.service}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {apt.status}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5">
                      <span>🕒 {formatDateTime(apt.startsAt)}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">Asia/Karachi</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/dashboard/appointments"
                    className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    Manage / Cancel
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Specialists & Doctors Directory */}
      <div className="space-y-4 pt-4 border-t border-slate-200/80">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Available Doctors & Specialists
            </h2>
            <p className="text-xs text-slate-500">
              Browse clinical specialists and book consultation slots instantly
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            ● 4 Specialists On Duty
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_DOCTORS.map((doc) => (
            <div
              key={doc.id}
              className="glass-card rounded-2xl p-5 border border-slate-200/80 hover:border-indigo-200 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl shadow-2xs">
                      {doc.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                          {doc.name}
                        </h3>
                        {doc.badge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {doc.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-indigo-600 font-medium">
                        {doc.specialty}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {doc.rating}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 rounded-xl p-3 border border-slate-100 mb-3 text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-700 block">Timings:</span>
                    <span>{doc.timings}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700 block">Consultation:</span>
                    <span className="text-emerald-700 font-semibold">{doc.fee}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Open Slots Today:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.openSlotsSample.map((slot, sIdx) => (
                      <span
                        key={sIdx}
                        className="text-[11px] font-medium px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs"
                      >
                        {slot}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {doc.availability}
                </span>

                <Link
                  href={`/dashboard/chat?doctor=${encodeURIComponent(doc.name)}&service=${encodeURIComponent(doc.serviceName)}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-bg text-white text-xs font-semibold shadow-xs hover:shadow active:scale-95 transition-all"
                >
                  <span>Book with AI</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
