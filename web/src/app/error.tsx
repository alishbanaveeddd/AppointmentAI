/**
 * Custom error page for the App Router.
 * Must be a client component to handle runtime errors.
 */
'use client';

export default function GlobalError({
  error: _error,
  reset: _reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
    </div>
  );
}
