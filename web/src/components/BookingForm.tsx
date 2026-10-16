/**
 * M8 — BookingForm component.
 *
 * Appears as a fallback when the AI assistant cannot process a booking request
 * (e.g., Groq provider failure returns `needs_fallback` state). Lets the user
 * manually provide service, date, and time, then creates a proposal via the
 * appointment API directly.
 */
'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui';
import { BOOKING_TIMEZONE } from '@/lib/date';
import type { ProposalInfo } from '@/lib/types';

interface Props {
  defaultService?: string;
  onSuccess: (proposal: ProposalInfo) => void;
}

export function BookingForm({ defaultService = '', onSuccess }: Props) {
  const [service, setService] = useState(defaultService);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!service.trim() || !date || !time) {
      setError('Please fill in all fields (service, date, and time).');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const [year, month, day] = date.split('-').map(Number);
      const [hour, minute] = time.split(':').map(Number);
      // Asia/Karachi = UTC+5 (no DST) — mirrors server resolveProposalDateTime
      const startsAt = new Date(
        Date.UTC(year, month - 1, day, hour - 5, minute, 0, 0),
      );
      const endsAt = new Date(startsAt.getTime() + 30 * 60_000);

      const res = await api.createProposal({
        service: service.trim(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timezone: BOOKING_TIMEZONE,
        durationMinutes: 30,
      });

      const proposalInfo: ProposalInfo = {
        proposalId: res.proposal.proposalId,
        service: res.proposal.service,
        startsAt: res.proposal.startsAt,
        endsAt: res.proposal.endsAt,
        timezone: res.proposal.timezone,
        durationMinutes: res.proposal.durationMinutes,
        expiresAt: res.proposal.expiresAt,
      };

      onSuccess(proposalInfo);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not create proposal. Please verify the time falls in business hours (Mon-Fri 9-5).');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="my-4 rounded-2xl border border-indigo-200/90 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
          ✏️
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
            Manual Booking Fallback
          </h3>
          <p className="text-xs text-slate-500">
            Select your preferred slot (Business hours: Mon–Fri, 9:00 AM – 5:00 PM Asia/Karachi)
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            Service Title *
          </label>
          <input
            type="text"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="e.g. General Consultation, Dental Checkup, Product Demo"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-3 focus:ring-indigo-600/15"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Date *
            </label>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-3 focus:ring-indigo-600/15"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Start Time (30-min slot) *
            </label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-3 focus:ring-indigo-600/15"
            >
              <option value="">Select time…</option>
              <option value="09:00">09:00 AM</option>
              <option value="09:30">09:30 AM</option>
              <option value="10:00">10:00 AM</option>
              <option value="10:30">10:30 AM</option>
              <option value="11:00">11:00 AM</option>
              <option value="11:30">11:30 AM</option>
              <option value="12:00">12:00 PM</option>
              <option value="12:30">12:30 PM</option>
              <option value="13:00">01:00 PM</option>
              <option value="13:30">01:30 PM</option>
              <option value="14:00">02:00 PM</option>
              <option value="14:30">02:30 PM</option>
              <option value="15:00">03:00 PM</option>
              <option value="15:30">03:30 PM</option>
              <option value="16:00">04:00 PM</option>
              <option value="16:30">04:30 PM</option>
            </select>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Create Proposal
          </Button>
        </div>
      </form>
    </div>
  );
}
