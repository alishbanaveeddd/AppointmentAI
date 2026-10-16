'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { AVAILABLE_DOCTORS } from '@/lib/doctors';

type DepartmentFilter = 'All' | 'Dental' | 'Cardiology' | 'General' | 'Pediatrics';

export default function DoctorsPage() {
  const [selectedDept, setSelectedDept] = useState<DepartmentFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDoctors = useMemo(() => {
    return AVAILABLE_DOCTORS.filter((doc) => {
      const matchesDept = selectedDept === 'All' || doc.department === selectedDept;
      const matchesSearch =
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDept && matchesSearch;
    });
  }, [selectedDept, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Clinical Specialists & Doctors
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              ● 4 On Duty
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Browse verified medical and dental specialists, view real-time open slots, and book instant consultations.
          </p>
        </div>

        <Link
          href="/dashboard/chat"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white font-semibold text-xs shadow-xs hover:shadow active:scale-95 transition-all self-start sm:self-auto"
        >
          <span>✨</span>
          <span>Ask AI to Recommend Doctor</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card rounded-2xl p-4 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Department Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {(['All', 'Dental', 'Cardiology', 'General', 'Pediatrics'] as DepartmentFilter[]).map((dept) => {
            const count =
              dept === 'All'
                ? AVAILABLE_DOCTORS.length
                : AVAILABLE_DOCTORS.filter((d) => d.department === dept).length;
            const isSelected = selectedDept === dept;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {dept === 'Dental' && '🦷 '}
                {dept === 'Cardiology' && '❤️ '}
                {dept === 'General' && '🩺 '}
                {dept === 'Pediatrics' && '👶 '}
                {dept} ({count})
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search doctor or specialty…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Doctor Cards Grid */}
      {filteredDoctors.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border border-slate-200/80">
          <div className="text-3xl mb-3">🔍</div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No specialists found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Try adjusting your department filter or searching with different keywords.
          </p>
          <button
            onClick={() => {
              setSelectedDept('All');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredDoctors.map((doc) => (
            <div
              key={doc.id}
              className="glass-card rounded-3xl p-6 border border-slate-200/80 hover:border-indigo-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Doctor Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-3xl shadow-xs shrink-0">
                      {doc.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                          {doc.name}
                        </h2>
                        {doc.badge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {doc.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-indigo-600 font-semibold mb-1">
                        {doc.specialty}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{doc.rating}</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          {doc.availability}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-3 gap-2.5 text-xs bg-slate-50/70 rounded-2xl p-3.5 border border-slate-100 mb-4">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Department</span>
                    <span className="font-bold text-slate-800">{doc.department}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Days & Hours</span>
                    <span className="font-semibold text-slate-800">{doc.availableDays}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Consultation Fee</span>
                    <span className="font-bold text-emerald-700">{doc.fee}</span>
                  </div>
                </div>

                {/* Available Slots Today */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">
                      Available Open Slots:
                    </span>
                    <span className="text-[11px] text-slate-400">
                      30-min consultation window
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {doc.openSlotsSample.map((slot, sIdx) => (
                      <Link
                        key={sIdx}
                        href={`/dashboard/chat?doctor=${encodeURIComponent(doc.name)}&service=${encodeURIComponent(doc.serviceName)}&slot=${encodeURIComponent(slot)}`}
                        className="text-center py-2 px-2.5 rounded-xl bg-white border border-slate-200/90 hover:border-indigo-500 hover:bg-indigo-50/50 hover:text-indigo-700 text-xs font-semibold text-slate-700 shadow-2xs hover:shadow-xs transition-all group"
                      >
                        <span className="block">{slot}</span>
                        <span className="text-[9px] text-slate-400 group-hover:text-indigo-500">
                          Book Slot →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Timezone: <strong className="text-slate-700">Asia/Karachi</strong>
                </span>

                <Link
                  href={`/dashboard/chat?doctor=${encodeURIComponent(doc.name)}&service=${encodeURIComponent(doc.serviceName)}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-bg text-white text-xs font-semibold shadow-xs hover:shadow active:scale-95 transition-all"
                >
                  <span>💬 Book with AI Assistant</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
