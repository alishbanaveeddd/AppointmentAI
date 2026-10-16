/**
 * M8 — AppointmentCard component.
 *
 * Renders a single appointment with its status and a Cancel button
 * that is only shown when the appointment is eligible for cancellation
 * (confirmed AND at least 2 hours before start — D-008).
 */
'use client';

import { useState } from 'react';
import type { Appointment } from '@/lib/types';
import { formatDateTime, getCancellationBlockReason } from '@/lib/date';
import { Button } from '@/components/ui';
import { isApiError } from '@/lib/auth';

interface Props {
  appointment: Appointment;
  onCancel: () => Promise<void>;
}

export function AppointmentCard({ appointment, onCancel }: Props) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const blockReason = getCancellationBlockReason(
    appointment.startsAt,
    appointment.status,
  );

  const handleCancel = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to cancel your "${appointment.service}" appointment scheduled for ${formatDateTime(appointment.startsAt)}?`,
    );
    if (!confirmed) return;

    setIsCancelling(true);
    setCancelError(null);
    try {
      await onCancel();
    } catch (err) {
      if (isApiError(err)) {
        setCancelError(err.message);
      } else if (err instanceof Error) {
        setCancelError(err.message);
      } else {
        setCancelError('An unexpected error occurred.');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    confirmed: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    cancelled: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' },
    completed: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  };

  const currentStatus = statusConfig[appointment.status] ?? statusConfig.confirmed;

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {appointment.service}
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${currentStatus.bg} ${currentStatus.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`}></span>
                {appointment.status}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5 mt-0.5">
              <span>📅 {formatDateTime(appointment.startsAt)}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 text-xs">Asia/Karachi</span>
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div>
          {blockReason === null && (
            <Button
              variant="danger"
              size="sm"
              isLoading={isCancelling}
              onClick={handleCancel}
              disabled={isCancelling}
            >
              Cancel Booking
            </Button>
          )}
        </div>
      </div>

      {blockReason && (
        <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-100 flex items-center gap-1.5">
          <span>ℹ️</span>
          <span>{blockReason}</span>
        </div>
      )}

      {cancelError && (
        <div className="mt-2 text-xs text-rose-700 bg-rose-50 rounded-xl px-3 py-1.5 border border-rose-200">
          {cancelError}
        </div>
      )}
    </div>
  );
}
