/**
 * M8 — Reusable UI primitives.
 *
 * Polished, accessible components built with Tailwind CSS and modern styling tokens.
 */
import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  HTMLAttributes,
} from 'react';

/* ------------------------------------------------------------------ *
 * Spinner
 * ------------------------------------------------------------------ */

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      aria-label="Loading"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Button
 * ------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow active:scale-[0.99] focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2',
  secondary:
    'bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-[0.99] focus:ring-2 focus:ring-slate-400 focus:ring-offset-2',
  outline:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs active:scale-[0.99] focus:ring-2 focus:ring-slate-300 focus:ring-offset-2',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-2 focus:ring-slate-300 focus:ring-offset-2',
  danger:
    'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300 focus:ring-2 focus:ring-rose-500/40 focus:ring-offset-2',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm font-medium rounded-xl gap-2',
  lg: 'px-6 py-2.5 text-base font-semibold rounded-xl gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center cursor-pointer
        transition-all duration-150 ease-out select-none
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className ?? ''}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner size={size === 'sm' ? 14 : 16} />
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export function Input({
  label,
  error,
  helperText,
  icon,
  className,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label
          className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
          htmlFor={props.id}
        >
          {label}
        </label>
      )}
      <div className="relative rounded-xl shadow-xs">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-all duration-150
            placeholder:text-slate-400 focus:outline-none
            disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
            ${icon ? 'pl-10' : ''}
            ${
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15'
                : 'border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-3 focus:ring-indigo-600/15'
            }
            ${className ?? ''}
          `}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

export function Card({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`
        glass-card rounded-2xl p-6 transition-all duration-200
        ${className ?? ''}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
