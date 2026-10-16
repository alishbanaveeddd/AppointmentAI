/**
 * M8 — ProposalCard component.
 *
 * Renders a booking proposal returned by the chat assistant.
 * Shows the unique proposalId (D-009), service details, and provides
 * explicit "Confirm" and "Edit details" actions.
 *
 * Per D-009: the proposal must NOT be labelled "Booked" until the
 * server returns a persisted appointment record.
 */
'use client';

import type { ProposalInfo } from '@/lib/types';
import { formatDateTime, getProposalTimeRemaining } from '@/lib/date';
import { Button } from '@/components/ui';

interface Props {
  proposal: ProposalInfo;
  isConfirming: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

export function ProposalCard({ proposal, isConfirming, onConfirm, onEdit }: Props) {
  const remaining = getProposalTimeRemaining(proposal.expiresAt);

  return (
    <div className="my-4 rounded-2xl border-2 border-indigo-200 bg-linear-to-b from-indigo-50/80 to-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-indigo-100">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-xs">
            📋
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              Booking Proposal Ready
            </h3>
            <p className="text-[11px] text-slate-500">
              Review details below and confirm to finalize your slot
            </p>
          </div>
        </div>

        {remaining && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200/80">
            <span>⏱️</span>
            <span>Expires in {remaining}</span>
          </span>
        )}
      </div>

      {/* Grid of Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm mb-5">
        <div className="bg-white/80 rounded-xl p-3 border border-indigo-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
            Service
          </span>
          <span className="font-bold text-slate-900">{proposal.service}</span>
        </div>

        <div className="bg-white/80 rounded-xl p-3 border border-indigo-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
            Duration
          </span>
          <span className="font-bold text-slate-900">{proposal.durationMinutes} Minutes</span>
        </div>

        <div className="bg-white/80 rounded-xl p-3 border border-indigo-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
            Date & Start Time
          </span>
          <span className="font-bold text-indigo-700">{formatDateTime(proposal.startsAt)}</span>
        </div>

        <div className="bg-white/80 rounded-xl p-3 border border-indigo-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
            Timezone
          </span>
          <span className="font-bold text-slate-800">{proposal.timezone}</span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            isLoading={isConfirming}
            onClick={onConfirm}
            disabled={isConfirming}
            className="shadow-xs hover:shadow"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>{isConfirming ? 'Securing Slot…' : 'Confirm & Reserve Booking'}</span>
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={onEdit}
            disabled={isConfirming}
          >
            Edit Details
          </Button>
        </div>

        <span className="text-[11px] font-mono text-slate-400" title="Proposal ID">
          Ref: {proposal.proposalId.slice(0, 8)}…
        </span>
      </div>
    </div>
  );
}
