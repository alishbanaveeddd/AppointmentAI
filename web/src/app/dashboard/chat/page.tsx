'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type {
  ChatSession,
  ChatMessage as ChatMsg,
  ProposalInfo,
  Appointment,
} from '@/lib/types';
import { Spinner } from '@/components/ui';
import { ChatMessageBubble } from '@/components/ChatMessage';
import { ProposalCard } from '@/components/ProposalCard';
import { BookingForm } from '@/components/BookingForm';
import { formatDateTime } from '@/lib/date';

const QUICK_PROMPTS = [
  '📅 Book a general consultation next Monday at 10:00 AM',
  '🦷 Schedule a dental checkup for tomorrow afternoon',
  '🕒 What are your business hours and available slots?',
];

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Spinner size={24} className="text-indigo-600" />
          <span className="text-sm font-medium">Loading AI Assistant…</span>
        </div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}

function ChatWorkspace() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const doctorParam = searchParams.get('doctor');
  const serviceParam = searchParams.get('service');
  const slotParam = searchParams.get('slot');

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentProposal, setCurrentProposal] = useState<ProposalInfo | null>(null);
  const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(null);
  const [needsFallback, setNeedsFallback] = useState(false);
  const [defaultFormService, setDefaultFormService] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Pre-populate input if doctor / slot query param is passed
  useEffect(() => {
    if (doctorParam) {
      if (slotParam) {
        setInput(`I would like to book an appointment with ${doctorParam} for tomorrow at ${slotParam}`);
      } else if (serviceParam) {
        setInput(`I would like to book a ${serviceParam} for tomorrow at 10:00 AM`);
      } else {
        setInput(`I would like to book an appointment with ${doctorParam} for tomorrow`);
      }
    }
  }, [doctorParam, serviceParam, slotParam]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, currentProposal, currentAppointment, isSending]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    setError(null);
    try {
      const res = await api.listSessions();
      let list = res.sessions;
      if (list.length === 0) {
        const created = await api.createSession();
        list = [created.session, ...list];
      }
      setSessions(list);
      if (list.length > 0) {
        setActiveSession(list[0]);
        await loadMessages(list[0].id);
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Could not load sessions.');
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const res = await api.getMessages(sessionId);
      setMessages(res.messages);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Could not load messages.');
    }
  };

  const handleNewSession = async () => {
    if (isCreatingSession || isSending) return;
    setIsCreatingSession(true);
    setError(null);
    try {
      const res = await api.createSession();
      const newSession = res.session;
      setSessions([newSession, ...sessions]);
      setActiveSession(newSession);
      setMessages([]);
      setCurrentProposal(null);
      setCurrentAppointment(null);
      setNeedsFallback(false);
      setDefaultFormService('');
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Could not create a new chat.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSelectSession = async (session: ChatSession) => {
    if (isSending || session.id === activeSession?.id) return;
    setActiveSession(session);
    setCurrentProposal(null);
    setCurrentAppointment(null);
    setNeedsFallback(false);
    setDefaultFormService('');
    setError(null);
    await loadMessages(session.id);
  };

  const appendMessage = (msg: ChatMsg) => {
    setMessages((prev) => [...prev, msg]);
  };

  const sendMessage = async (content: string, addLocalUser = true) => {
    if (!activeSession) return;
    if (addLocalUser) {
      appendMessage({
        id: `user-${Date.now()}`,
        sessionId: activeSession.id,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      });
    }
    setIsSending(true);
    setError(null);
    scrollToBottom();
    try {
      const res = await api.sendMessage(activeSession.id, content);
      appendMessage(res.message);
      if (res.booking?.state === 'needs_fallback') {
        setNeedsFallback(true);
        setCurrentProposal(null);
        setCurrentAppointment(null);
      } else if (res.booking?.proposal) {
        setCurrentProposal(res.booking.proposal);
        setNeedsFallback(false);
      } else {
        setCurrentProposal(null);
      }
      if (res.appointment) {
        setCurrentAppointment(res.appointment);
        setCurrentProposal(null);
        setNeedsFallback(false);
      }
      // If title changed after first message, update session list
      if (!activeSession.title && content) {
        const updatedTitle = content.slice(0, 45) + (content.length > 45 ? '…' : '');
        setActiveSession((prev) => (prev ? { ...prev, title: updatedTitle } : prev));
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSession.id ? { ...s, title: updatedTitle } : s)),
        );
      }
    } catch (err) {
      let msg = 'I encountered an error. Please try again.';
      if (err instanceof ApiError) {
        msg = err.isConflict
          ? err.message
          : `I encountered an error: ${err.message}. Please try again.`;
      }
      appendMessage({
        id: `error-${Date.now()}`,
        sessionId: activeSession.id,
        role: 'assistant',
        content: msg,
        createdAt: new Date().toISOString(),
      });
    } finally {
      scrollToBottom();
      setIsSending(false);
    }
  };

  const handleSendMessage = () => {
    if (!input.trim() || isSending || !activeSession) return;
    const content = input.trim();
    setInput('');
    void sendMessage(content);
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isSending || !activeSession) return;
    // Strip leading emoji if desired or send directly
    const text = prompt.replace(/^[^\w]+/, '');
    void sendMessage(text);
  };

  const handleConfirmProposal = async () => {
    if (!currentProposal || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await api.confirmProposal(currentProposal.proposalId);
      appendMessage({
        id: `confirm-${Date.now()}`,
        sessionId: activeSession?.id ?? '',
        role: 'assistant',
        content: res.isNew
          ? `Your ${res.appointment.service} appointment is confirmed for ${formatDateTime(res.appointment.startsAt)}.`
          : `Your ${res.appointment.service} appointment is already confirmed for ${formatDateTime(res.appointment.startsAt)}.`,
        createdAt: new Date().toISOString(),
      });
      setCurrentAppointment(res.appointment);
      setCurrentProposal(null);
    } catch (err) {
      let msg = 'Could not confirm the appointment. Please try again.';
      if (err instanceof ApiError) msg = err.message;
      appendMessage({
        id: `error-${Date.now()}`,
        sessionId: activeSession?.id ?? '',
        role: 'assistant',
        content: msg,
        createdAt: new Date().toISOString(),
      });
      setCurrentProposal(null);
    } finally {
      scrollToBottom();
      setIsSending(false);
    }
  };

  const handleEditProposal = () => {
    if (!activeSession || isSending || !currentProposal) return;
    setDefaultFormService(currentProposal.service);
    setCurrentProposal(null);
    setNeedsFallback(true);
  };

  // Auth / Loading states
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-slate-500">
          <Spinner size={24} className="text-indigo-600" />
          <span className="text-sm font-medium">Loading session…</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (sessionsLoading) {
    return (
      <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Spinner size={24} className="text-indigo-600" />
        <span className="text-sm font-medium">Initializing AI workspace…</span>
      </div>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 text-sm text-rose-700">
        <p className="font-semibold mb-2">Error loading conversations</p>
        <p className="mb-4">{error}</p>
        <button
          onClick={loadSessions}
          className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs shadow-xs hover:bg-rose-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={24} className="text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col md:flex-row h-[calc(100vh-100px)] min-h-[580px]">
      {/* Left Column: Chat Sessions Drawer (Desktop Sidebar) */}
      <div className="hidden md:flex w-72 shrink-0 border-r border-slate-200/80 bg-slate-50/60 flex-col">
        {/* New Chat Header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Conversations
          </span>
          <button
            onClick={handleNewSession}
            disabled={isCreatingSession || isSending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-indigo-600 text-xs font-semibold shadow-2xs hover:bg-indigo-50/50 disabled:opacity-50 transition-all cursor-pointer"
          >
            <span>+</span>
            <span>{isCreatingSession ? 'Creating…' : 'New Chat'}</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {sessions.map((s) => {
            const isActive = s.id === activeSession.id;
            return (
              <button
                key={s.id}
                onClick={() => void handleSelectSession(s)}
                disabled={isSending}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer ${
                  isActive
                    ? 'bg-white text-indigo-900 font-semibold shadow-xs border border-indigo-100 border-l-4 border-l-indigo-600'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                <span className="text-slate-400">💬</span>
                <span className="truncate flex-1">
                  {s.title || 'New conversation'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Chat Arena */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Arena Header */}
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between gap-3 bg-white/80 backdrop-blur-xs">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 text-sm font-bold">
              🤖
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {activeSession.title || 'New Consultation Chat'}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Groq LLM Active
                </span>
                <span>•</span>
                <span>Asia/Karachi</span>
              </div>
            </div>
          </div>

          {/* Mobile Session Switcher & New Chat button */}
          <div className="flex items-center gap-2 md:hidden">
            {sessions.length > 1 && (
              <select
                value={activeSession.id}
                onChange={(e) => {
                  const s = sessions.find((x) => x.id === e.target.value);
                  if (s) void handleSelectSession(s);
                }}
                disabled={isSending}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 bg-white"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || 'Chat'}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleNewSession}
              disabled={isCreatingSession || isSending}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold"
            >
              + New
            </button>
          </div>
        </div>

        {/* Doctor Consultation Context Banner */}
        {doctorParam && (
          <div className="px-4 py-2.5 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">👨‍⚕️</span>
              <div className="truncate">
                <span className="font-bold text-indigo-950">
                  Consultation with {doctorParam}
                </span>
                <span className="text-indigo-600 ml-1.5 font-medium">
                  ({serviceParam || 'Specialist Consultation'}{slotParam ? ` • ${slotParam}` : ''})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const text = slotParam
                  ? `Please book an appointment with ${doctorParam} for tomorrow at ${slotParam}`
                  : `Please book an appointment with ${doctorParam} for tomorrow at 10:00 AM`;
                void sendMessage(text);
              }}
              disabled={isSending}
              className="px-3 py-1 rounded-lg gradient-bg text-white font-semibold text-[11px] shadow-2xs hover:shadow-xs disabled:opacity-50 transition-all cursor-pointer shrink-0"
            >
              ⚡ Send Request
            </button>
          </div>
        )}

        {/* Scrollable Message History Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 bg-slate-50/30">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
              <div className="h-14 w-14 rounded-2xl gradient-bg text-white flex items-center justify-center text-2xl shadow-sm mb-4 animate-float">
                💬
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                How can I help you schedule?
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
                Describe the service and time you'd like in plain English. I'll check availability and prepare an instant proposal.
              </p>

              {/* Quick Prompts */}
              <div className="w-full space-y-2 text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Try asking:
                </span>
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickPrompt(prompt)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-xs text-slate-700 hover:text-indigo-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))
          )}

          {/* Fallback Form */}
          {needsFallback && !currentProposal && (
            <div className="px-2 sm:px-4 py-2">
              <BookingForm
                defaultService={defaultFormService}
                onSuccess={(proposal) => {
                  setCurrentProposal(proposal);
                  setNeedsFallback(false);
                  setDefaultFormService('');
                }}
              />
            </div>
          )}

          {/* Proposal Card */}
          {currentProposal && (
            <div className="px-2 sm:px-4 py-2">
              <ProposalCard
                proposal={currentProposal}
                isConfirming={isSending}
                onConfirm={handleConfirmProposal}
                onEdit={handleEditProposal}
              />
            </div>
          )}

          {/* Confirmed Appointment Banner */}
          {currentAppointment && !currentProposal && (
            <div className="px-2 sm:px-4 py-3">
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/90 p-5 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-base font-bold shadow-xs">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-emerald-900">
                      Appointment Confirmed & Reserved!
                    </h3>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      <span className="font-semibold">{currentAppointment.service}</span>
                      <span> • </span>
                      <span>{formatDateTime(currentAppointment.startsAt)}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Typing Indicator */}
          {isSending && (
            <ChatMessageBubble
              message={{
                id: 'typing',
                sessionId: activeSession.id,
                role: 'assistant',
                content: '',
                createdAt: new Date().toISOString(),
              }}
              isTyping
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200/80 bg-white">
          {error && (
            <div className="mb-2 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="relative flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-1.5 focus-within:border-indigo-600 focus-within:ring-3 focus-within:ring-indigo-600/15 focus-within:bg-white transition-all shadow-xs">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                currentProposal
                  ? 'Type "yes" to confirm or request a different time…'
                  : isSending
                    ? 'Assistant is preparing response…'
                    : 'Message AI assistant (e.g. "Schedule consultation next Tuesday at 2pm")…'
              }
              className="flex-1 resize-none bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none min-h-[44px] max-h-[120px]"
              rows={1}
              disabled={isSending}
              maxLength={4000}
            />

            <button
              type="button"
              onClick={handleSendMessage}
              disabled={isSending || !input.trim()}
              className="h-10 px-4 rounded-xl gradient-bg text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs hover:shadow disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSending ? (
                <Spinner size={16} />
              ) : (
                <>
                  <span>Send</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Press Enter ↵ to send • Shift+Enter for newline</span>
            <span>{input.length} / 4000</span>
          </div>
        </div>
      </div>
    </div>
  );
}
