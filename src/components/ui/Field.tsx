'use client'

import { useId } from 'react'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

// Labelled form controls. Fixes: labels were never associated with their
// inputs (no htmlFor), so screen readers announced unlabeled fields and
// tapping a label didn't focus the input. Optional fields are marked instead
// of starring every required one.
export const controlClass =
  'w-full bg-ivory border border-border rounded-lg px-3.5 text-sm text-ink placeholder:text-inkFaint ' +
  'focus:outline-none focus:border-brandDim focus:ring-2 focus:ring-brand/20 transition disabled:opacity-60 ' +
  'aria-[invalid=true]:border-danger'

interface ShellProps {
  id: string
  label: string
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  children: ReactNode
  className?: string
}

function FieldShell({ id, label, hint, error, optional, children, className = '' }: ShellProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-inkFaint">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="mt-1.5 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-xs text-inkFaint">{hint}</p>
      ) : null}
    </div>
  )
}

type Extra = { label: string; hint?: ReactNode; error?: string | null; optional?: boolean; wrapperClassName?: string }

export function TextField({ label, hint, error, optional, wrapperClassName, className = '', ...props }: Extra & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={`${controlClass} h-11 ${className}`}
        {...props}
      />
    </FieldShell>
  )
}

export function TextAreaField({ label, hint, error, optional, wrapperClassName, className = '', ...props }: Extra & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={`${controlClass} py-3 resize-none ${className}`}
        {...props}
      />
    </FieldShell>
  )
}

export function SelectField({ label, hint, error, optional, wrapperClassName, className = '', children, ...props }: Extra & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={`${controlClass} h-11 ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
}
