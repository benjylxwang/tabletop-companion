import React from 'react';

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ error = false, rows = 4, className = '', ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={error || undefined}
        className={[
          'w-full rounded border bg-parchment-200 px-3 py-2 text-sm text-ink-900',
          'placeholder:text-ink-300 resize-y',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error
            ? 'border-crimson-600 focus:ring-crimson-600'
            : 'border-parchment-300',
          className,
        ].join(' ')}
        {...rest}
      />
    );
  },
);
