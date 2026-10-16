/**
 * M8 — Signup page.
 *
 * Form for new users to register. On success, the API sets an HttpOnly
 * auth_token cookie and redirects to /dashboard.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, isApiError } from '@/lib/auth';
import type { SignupInput } from '@/lib/types';
import { Input, Button } from '@/components/ui';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

export default function SignupPage() {
  const router = useRouter();
  const { user, signup, isLoading: authLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<SignupInput>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // If already authenticated, redirect to dashboard.
  if (user) {
    router.replace('/dashboard');
    return null;
  }

  const validate = (): boolean => {
    const newErrors: Partial<SignupInput> = {};

    const trimmedName = name.trim();
    if (!trimmedName) newErrors.name = 'Name is required';
    else if (trimmedName.length > 100)
      newErrors.name = 'Name must be at most 100 characters';

    if (!email) newErrors.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email)) newErrors.email = 'Invalid email address';

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (password.length > 128) {
      newErrors.password = 'Password must be at most 128 characters';
    } else if (!PASSWORD_REGEX.test(password)) {
      newErrors.password =
        'Password must contain at least one uppercase letter, one lowercase letter, and one digit';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    try {
      await signup({ name: name.trim(), email, password });
      router.replace('/dashboard');
    } catch (err) {
      if (isApiError(err)) {
        setSubmitError(err.message);
      } else {
        setSubmitError('An error occurred. Please try again.');
      }
    }
  };

  const inputDisabled = authLoading;
  const isLoading = authLoading;

  return (
    <main className="min-h-screen mesh-gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group mb-3">
            <div className="h-10 w-10 rounded-xl gradient-bg flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-extrabold text-2xl text-slate-900 tracking-tight">
              Appointment<span className="text-indigo-600">AI</span>
            </span>
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Get started with AI-assisted scheduling in seconds
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-lg border border-slate-200/80">
          {submitError && (
            <div className="mb-5 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs sm:text-sm text-rose-700 flex items-start gap-2.5">
              <svg className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="name"
              label="Full Name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              error={errors.name}
              disabled={inputDisabled}
              placeholder="e.g. Alex Morgan"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />

            <Input
              id="email"
              label="Email Address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              error={errors.email}
              disabled={inputDisabled}
              placeholder="you@example.com"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                </svg>
              }
            />

            <Input
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              error={errors.password}
              disabled={inputDisabled}
              placeholder="Min. 8 chars, 1 uppercase, 1 digit"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
              disabled={inputDisabled}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs sm:text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
                Sign in here →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
