/**
 * M8 — Login page.
 *
 * Form for existing users to authenticate. Includes a 1-click demo filler
 * for reviewers/evaluators to instantly test the flow.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, isApiError } from '@/lib/auth';
import type { LoginInput } from '@/lib/types';
import { Input, Button } from '@/components/ui';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<LoginInput>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // If already authenticated, redirect to dashboard.
  if (user) {
    router.replace('/dashboard');
    return null;
  }

  const validate = (): boolean => {
    const newErrors: Partial<LoginInput> = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email)) newErrors.email = 'Invalid email address';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    try {
      await login({ email, password });
      router.replace('/dashboard');
    } catch (err) {
      if (isApiError(err)) {
        setSubmitError(err.message);
      } else {
        setSubmitError('An error occurred. Please try again.');
      }
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@example.com');
    setPassword('Demo@12345');
    setErrors({});
    setSubmitError(null);
  };

  const isLoading = authLoading;
  const inputDisabled = authLoading || isLoading;

  return (
    <main className="min-h-screen mesh-gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Logo Header */}
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
          <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sign in to continue to your appointment dashboard
          </p>
        </div>

        {/* 1-Click Demo Quick Filler */}
        <div className="mb-4 rounded-xl border border-indigo-200/90 bg-indigo-50/70 p-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="text-xs">
            <span className="font-semibold text-indigo-900 block">Assessment Reviewer?</span>
            <span className="text-indigo-700/80">Use pre-seeded demo account</span>
          </div>
          <button
            type="button"
            onClick={handleFillDemo}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            ⚡ Auto-Fill Demo
          </button>
        </div>

        {/* Form Card */}
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
              placeholder="demo@example.com"
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              error={errors.password}
              disabled={inputDisabled}
              placeholder="••••••••••••"
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
              Sign In
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs sm:text-sm text-slate-500">
              Don't have an account?{' '}
              <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700">
                Create one now →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
