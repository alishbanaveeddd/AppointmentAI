/**
 * M8 — ChatMessage component.
 *
 * Renders chat message bubbles with modern aesthetics, distinct user/assistant
 * styling, and subtle animations.
 */
'use client';

import type { ChatMessage as ChatMessageType } from '@/lib/types';

interface Props {
  message: ChatMessageType;
  /** When true, the assistant is "typing" (loading) and this is a placeholder. */
  isTyping?: boolean;
}

export function ChatMessageBubble({ message, isTyping = false }: Props) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex w-full gap-3 py-3 px-2 sm:px-4 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="h-9 w-9 rounded-xl gradient-bg text-white flex items-center justify-center shrink-0 shadow-xs text-xs font-bold mt-0.5">
          <span>AI</span>
        </div>
      )}

      {/* Bubble Content */}
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed transition-all ${
          isUser
            ? 'gradient-bg text-white rounded-tr-xs shadow-xs font-normal'
            : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-xs'
        }`}
      >
        {isTyping ? (
          <div className="flex items-center gap-1.5 py-1 px-2 text-indigo-500">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></span>
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:150ms]"></span>
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:300ms]"></span>
            <span className="text-xs text-slate-400 font-medium ml-2">Assistant is thinking…</span>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs text-xs font-bold mt-0.5">
          <span>You</span>
        </div>
      )}
    </div>
  );
}
