/**
 * M8 — Appointments page.
 *
 * Lists all appointments for the authenticated user with filter tabs,
 * quick actions, and eligibility-aware cancellation.
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { Appointment } from '@/lib/types';
import { Spinner } from '@/components/ui';
import { AppointmentCard } from '@/components/AppointmentCard';

type FilterTab = 'all' | 'confirmed' | 'past';

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
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
      const sorted = res.appointments.sort((a, b) => {
        const ta = new Date(a.startsAt).getTime();
        const tb = new Date(b.startsAt).getTime();
        return tb - ta; // newest first
      });
      setAppointments(sorted);
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

  const handleCancel = async (id: string) => {
    try {
      const res = await api.cancelAppointment(id);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? res.appointment : a)),
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not cancel appointment.');
      }
    }
  };

  const now = Date.now();
  const confirmedAppointments = appointments.filter(
    (a) => a.status === 'confirmed' && new Date(a.startsAt).getTime() > now,
  );
  const pastOrCancelledAppointments = appointments.filter(
    (a) => a.status !== 'confirmed' || new Date(a.startsAt).getTime() <= now,
  );

  const filteredAppointments =
    activeTab === 'confirmed'
      ? confirmedAppointments
      : activeTab === 'past'
        ? pastOrCancelledAppointments
        : appointments;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            My Appointments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            View, track, and manage your booked consultation slots
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAppointments}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            aria-label="Refresh appointments"
          >
            <span>↻</span>
            <span>Refresh</span>
          </button>

          <Link
            href="/dashboard/chat"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white gradient-bg shadow-xs hover:shadow transition-all"
          >
            <span>✨</span>
            <span>Book with AI</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All ({appointments.length})
        </button>
        <button
          onClick={() => setActiveTab('confirmed')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'confirmed'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Upcoming ({confirmedAppointments.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'past'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Past & Cancelled ({pastOrCancelledAppointments.length})
        </button>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Spinner size={24} className="text-indigo-600" />
          <span className="text-sm font-medium">Loading schedule…</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs sm:text-sm text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadAppointments}
            className="font-semibold text-rose-800 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border border-slate-200/80">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center text-2xl mb-3">
            📅
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {activeTab === 'all'
              ? 'No appointments found'
              : activeTab === 'confirmed'
                ? 'No upcoming appointments'
                : 'No past or cancelled appointments'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-6">
            Reserve a new 30-minute consultation slot anytime through natural dialogue with the AI assistant.
          </p>
          <Link
            href="/dashboard/chat"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white text-xs font-semibold shadow-xs hover:shadow transition-all"
          >
            <span>💬</span>
            <span>Book an Appointment Now</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((apt) => (
            <AppointmentCard
              key={apt.id}
              appointment={apt}
              onCancel={() => handleCancel(apt.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
