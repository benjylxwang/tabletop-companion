import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface ErrorDisplayProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}: ErrorDisplayProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-lg border border-crimson-200 bg-crimson-100 px-6 py-8 text-center ${className}`}
    >
      <AlertCircle className="h-8 w-8 text-crimson-600" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-crimson-700">{title}</p>
        {message && <p className="text-sm text-crimson-600">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
