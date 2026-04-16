import React from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-amber-500 text-parchment-50 hover:bg-amber-600 focus-visible:ring-amber-500 border-transparent',
  secondary:
    'bg-parchment-100 text-ink-700 hover:bg-parchment-200 focus-visible:ring-amber-500 border-parchment-300',
  danger:
    'bg-crimson-600 text-parchment-50 hover:bg-crimson-700 focus-visible:ring-crimson-600 border-transparent',
  ghost:
    'bg-transparent text-ink-700 hover:bg-parchment-100 focus-visible:ring-amber-500 border-transparent',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      className = '',
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={[
          'inline-flex items-center justify-center font-medium rounded border',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(' ')}
        {...rest}
      >
        {isLoading && <Spinner size="sm" />}
        {children}
      </button>
    );
  },
);
