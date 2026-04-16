import type { InputHTMLAttributes, ReactNode } from 'react';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/20 text-amber-400 font-bold select-none">
            TC
          </div>
          <span className="text-lg font-semibold tracking-tight text-amber-400">
            Tabletop Companion
          </span>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared auth form controls ───────────────────────────────────────────────
// Dark-palette form primitives used by Login/Signup. Distinct from the
// parchment-themed UI kit in frontend/src/components/ui — the auth screens
// deliberately sit in the darker app chrome, so the kit doesn't fit.

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
}

export function AuthField({ id, label, hint, ...inputProps }: AuthFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-300">
        {label}
      </label>
      <input
        id={id}
        name={id}
        {...inputProps}
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

interface AuthSubmitProps {
  submitting: boolean;
  idleLabel: string;
  busyLabel: string;
}

export function AuthSubmit({ submitting, idleLabel, busyLabel }: AuthSubmitProps) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="w-full rounded-md bg-amber-500 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60"
    >
      {submitting ? busyLabel : idleLabel}
    </button>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-xs text-red-400">
      {message}
    </p>
  );
}
