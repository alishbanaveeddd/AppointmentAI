/**
 * Custom 404 page for the App Router.
 * Replaces the default error page that uses Pages Router document semantics.
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">404 — Page not found</h1>
    </div>
  );
}
