'use client';

/**
 * Root-level error boundary for the App Router.
 * Replaces pages/_document error handling for unhandled errors.
 */
export default function GlobalError({
  error: _error,
  reset: _reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
        </div>
      </body>
    </html>
  );
}
