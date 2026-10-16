/**
 * M8 — API client for the Appointment AI frontend.
 *
 * Wraps `fetch` with:
 * - Base URL from NEXT_PUBLIC_API_URL (defaults to http://localhost:8000)
 * - credentials: 'include' for HttpOnly cookie auth
 * - Structured error parsing (matches API_CONTRACT.md error format)
 *
 * Per docs/SECURITY.md the auth JWT lives ONLY in the HttpOnly cookie;
 * it is never read or written by JavaScript. The browser sends it
 * automatically on same-site requests.
 */
import type {
  AuthResponse,
  SignupInput,
  LoginInput,
  ChatSession,
  ChatMessage,
  ChatResponse,
  Proposal,
  Appointment,
  CreateProposalInput,
  ConfirmationResult,
  CancellationResult,
  ApiErrorResponse,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Typed error thrown when the API returns a non-2xx response.
 * Mirrors the structured error body defined in API_CONTRACT.md.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly requestId?: string;
  public readonly conflict?: ApiErrorResponse['error']['conflict'];

  constructor(
    statusCode: number,
    code: string,
    message: string,
    requestId?: string,
    conflict?: ApiErrorResponse['error']['conflict'],
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.requestId = requestId;
    this.conflict = conflict;
  }

  /** True for HTTP 401 (auth required). */
  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  /** True for HTTP 409 (booking slot conflict / stale / expired proposal). */
  get isConflict(): boolean {
    return this.statusCode === 409;
  }
}

/**
 * Core fetch wrapper. Throws `ApiError` on non-2xx responses.
 */
async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!res.ok) {
    let errorBody: ApiErrorResponse = {
      error: { code: 'UNKNOWN_ERROR', message: res.statusText },
    };

    try {
      errorBody = (await res.json()) as ApiErrorResponse;
    } catch {
      // Non-JSON error body — fall through with defaults.
    }

    const err = errorBody?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN_ERROR',
      err?.message ?? res.statusText,
      err?.requestId,
      err?.conflict,
    );
  }

  // 204 No Content (logout)
  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/**
 * Typed API surface matching every endpoint in docs/API_CONTRACT.md.
 */
export const api = {
  // --- Health ---
  health: () => request<{ status: string }>('/health'),

  // --- Auth ---
  signup: (data: SignupInput): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginInput): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: (): Promise<void> =>
    request<void>('/auth/logout', { method: 'POST' }),

  me: (): Promise<AuthResponse> => request<AuthResponse>('/auth/me'),

  // --- Chat ---
  createSession: (data?: { title?: string }): Promise<{ session: ChatSession }> =>
    request<{ session: ChatSession }>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  listSessions: (): Promise<{ sessions: ChatSession[] }> =>
    request<{ sessions: ChatSession[] }>('/chat/sessions'),

  getMessages: (
    sessionId: string,
  ): Promise<{ messages: ChatMessage[] }> =>
    request<{ messages: ChatMessage[] }>(
      `/chat/sessions/${sessionId}/messages`,
    ),

  sendMessage: (
    sessionId: string,
    content: string,
  ): Promise<ChatResponse> =>
    request<ChatResponse>(
      `/chat/sessions/${sessionId}/messages`,
      { method: 'POST', body: JSON.stringify({ content }) },
    ),

  // --- Appointments: Proposals ---
  listProposals: (): Promise<{ proposals: Proposal[] }> =>
    request<{ proposals: Proposal[] }>('/appointments/proposals'),

  getProposal: (proposalId: string): Promise<{ proposal: Proposal }> =>
    request<{ proposal: Proposal }>(
      `/appointments/proposals/${proposalId}`,
    ),

  createProposal: (data: CreateProposalInput): Promise<{ proposal: Proposal }> =>
    request<{ proposal: Proposal }>('/appointments/proposals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  confirmProposal: (proposalId: string): Promise<ConfirmationResult> =>
    request<ConfirmationResult>(
      `/appointments/proposals/${proposalId}/confirm`,
      { method: 'POST' },
    ),

  // --- Appointments ---
  listAppointments: (): Promise<{ appointments: Appointment[] }> =>
    request<{ appointments: Appointment[] }>('/appointments'),

  getAppointment: (
    appointmentId: string,
  ): Promise<{ appointment: Appointment }> =>
    request<{ appointment: Appointment }>(
      `/appointments/${appointmentId}`,
    ),

  cancelAppointment: (
    appointmentId: string,
  ): Promise<CancellationResult> =>
    request<CancellationResult>(
      `/appointments/${appointmentId}/cancel`,
      { method: 'PATCH' },
    ),
};

/** Re-export ApiError as a named import for consumers. */
export type { ApiError as ApiErrorClass };